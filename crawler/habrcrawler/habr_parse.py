'''
Parser for Habr company article pages.

Extracts the fields required by the task from the article HTML and
persists them into MySQL via habrcrawler.db.
'''
import logging
import re

from bs4 import BeautifulSoup

from . import db
from . import stats

LOGGER = logging.getLogger(__name__)

# e.g. https://habr.com/ru/companies/ru_mts/articles/1066076/
ARTICLE_URL_RE = re.compile(
    r'/ru/companies/(?P<company>[^/]+)/articles/(?P<article_id>\d+)')


def _to_int(text):
    '''
    Convert counter text to int. Handles '+12', '−3' (unicode minus),
    '0', and compact forms like '1.9K' (best effort).
    '''
    if text is None:
        return None
    text = text.strip().replace('−', '-').replace('+', '')
    if not text:
        return None
    m = re.match(r'^-?\d+$', text)
    if m:
        return int(text)
    # compact form: 1.9K / 2M
    m = re.match(r'^(-?\d+(?:[.,]\d+)?)([KkMm])$', text)
    if m:
        num = float(m.group(1).replace(',', '.'))
        mult = 1000 if m.group(2).lower() == 'k' else 1000000
        return int(num * mult)
    return None


def parse_article_html(html, url):
    '''
    Parse article HTML, return a dict of extracted fields or None if the
    page is not a valid article page.
    '''
    soup = BeautifulSoup(html, 'lxml')

    h1 = soup.find('h1', class_='tm-title')
    if h1 is None:
        # not an article page (redirect target, error page, etc.)
        return None

    span = h1.find('span')
    title = span.get_text(strip=True) if span else h1.get_text(strip=True)

    m = ARTICLE_URL_RE.search(url)
    article_id = int(m.group('article_id')) if m else None

    # views counter: <span class="tm-icon-counter__value" title="1860">1.9K</span>
    stats_counter = None
    views_el = soup.find('span', class_='tm-icon-counter__value')
    if views_el is not None:
        stats_counter = views_el.get('title') or views_el.get_text(strip=True)

    # hubs: all links inside .tm-publication-hubs
    hubs = []
    hubs_container = soup.find(class_='tm-publication-hubs')
    if hubs_container is not None:
        for a in hubs_container.find_all('a', class_='tm-publication-hub__link'):
            href = a.get('href', '')
            hm = re.search(r'/hubs/([^/]+)/', href)
            cm = re.search(r'/companies/([^/]+)/', href)
            if hm:
                code = hm.group(1)
            elif cm:
                code = cm.group(1)
            else:
                code = href.strip('/').split('/')[-1]
            hub_title = a.get_text(' ', strip=True)
            if code:
                hubs.append({'code': code, 'title': hub_title})

    # label: <div class="publication-label variant-reportage"><span>Репортаж</span></div>
    label = None
    label_el = soup.find('div', class_=lambda c: c and 'publication-label' in c.split())
    if label_el is not None:
        classes = label_el.get('class', [])
        code = next((c[len('variant-'):] for c in classes
                     if c.startswith('variant-')), None)
        label_title = label_el.get_text(strip=True)
        label = {'code': code, 'title': label_title}

    # score: element with class tm-votes-meter__value_rating
    score_counter = None
    score_el = soup.find(class_=lambda c: c and 'tm-votes-meter__value_rating' in c.split())
    if score_el is not None:
        score_counter = _to_int(score_el.get_text(strip=True))

    # bookmarks: button.bookmarks-button span.counter
    bookmarks_counter = None
    bm_btn = soup.find('button', class_='bookmarks-button')
    if bm_btn is not None:
        counter_el = bm_btn.find('span', class_='counter')
        if counter_el is not None:
            bookmarks_counter = _to_int(counter_el.get_text(strip=True))

    # comments: .article-comments-counter-link span.value
    comments_counter = None
    comments_el = soup.find('a', class_='article-comments-counter-link')
    if comments_el is not None:
        value_el = comments_el.find('span', class_='value')
        if value_el is not None:
            comments_counter = _to_int(value_el.get_text(strip=True))

    return {
        'id': article_id,
        'title': title,
        'stats_counter': stats_counter,
        'hubs': hubs,
        'label': label,
        'score_counter': score_counter,
        'bookmarks_counter': bookmarks_counter,
        'comments_counter': comments_counter,
    }


async def parse_and_save(html, url, company_code):
    '''
    Parse the article page and write everything to the database.
    Returns True if an article was saved.
    '''
    try:
        data = parse_article_html(html, url)
    except Exception as e:
        LOGGER.warning('failed to parse %s: %s', url, e)
        stats.stats_sum('habr parse errors', 1)
        return False

    if data is None:
        stats.stats_sum('habr non-article pages', 1)
        return False

    if data['id'] is None:
        LOGGER.warning('no article id in url %s', url)
        return False

    label_code = None
    if data['label'] and data['label']['title']:
        label_code = await db.get_or_create_label(
            data['label']['code'] or '', data['label']['title'])

    inserted = await db.insert_article(
        article_id=data['id'],
        title=data['title'][:255],
        stats_counter=(data['stats_counter'] or '')[:255] or None,
        label_id=label_code,
        company_code=company_code,
        score_counter=data['score_counter'],
        bookmarks_counter=data['bookmarks_counter'],
        comments_counter=data['comments_counter'],
    )

    if inserted:
        for hub in data['hubs']:
            hub_code = await db.get_or_create_hub(hub['code'], hub['title'])
            await db.link_article_hub(data['id'], hub_code)
        LOGGER.info('saved article %s (%s) for company %s',
                    data['id'], data['title'][:50], company_code)

    return inserted
