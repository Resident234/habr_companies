'''
Seed generation and parsing for Habr company news list pages.

Unlike individual news pages, company news live on paginated list pages:

    https://habr.com/ru/companies/{company}/news/
    https://habr.com/ru/companies/{company}/news/page2/
    ...

Each page contains multiple news previews in
<article id="..." class="tm-articles-list__item ..."> blocks.

The news preview contains the news id, title, views counter,
hubs, score, bookmarks, and comments counters.

Pagination: one page per company is queued at a time. If the parsed
page still contains news, the next page is queued from
parse_and_save_news() (chaining); an empty page ends the walk.
'''
import logging
import re
from urllib.parse import urljoin

from bs4 import BeautifulSoup

from . import config
from . import db
from . import stats
from . import habr_parse
from .urls import URL

LOGGER = logging.getLogger(__name__)

NEWS_URL_TEMPLATE = 'https://habr.com/ru/companies/{company}/news/'

# <article id="1026612" class="tm-articles-list__item ...">
NEWS_ID_RE = re.compile(r'^\d+$')


def news_page_url(template, company, page):
    '''
    Build the url of one news page. Page 1 is the bare template,
    pages 2+ append 'page{N}/'.
    '''
    if page <= 1:
        return template.format(company=company)
    base = template.format(company=company)
    return urljoin(base, 'page{}/'.format(page))


class HabrNewsSeedGenerator:
    '''
    Generates the first news page url for every company in the
    database. Pagination is chained from the parser: if a parsed page
    still contains news, the next page is queued from
    parse_and_save_news() until a page comes back empty.
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'NewsPagesUrlTemplate') or NEWS_URL_TEMPLATE
        self.companies = []
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        LOGGER.info('seeding news pages for %d companies', len(self.companies))
        self._queue_batch()

    def _queue_batch(self):
        '''
        Push the first news page of every company into the scheduler.
        '''
        if self.exhausted:
            return

        queued = 0
        for company_code, _last_processed in self.companies:
            self.queue_news_page(company_code, 1)
            queued += 1

        stats.stats_sum('habr news urls queued', queued)
        self.exhausted = True

    def queue_news_page(self, company_code, page):
        '''Enqueue one news page of one company.'''
        url = news_page_url(self.template, company_code, page)
        ridealong = {
            'url': URL(url),
            'priority': 1,
            'seed': True,
            'retries_left': config.read('Crawl', 'MaxTries'),
            'seed_host': 'habr.com',
            'company_code': company_code,
            'news_page': True,
            'news_page_number': page,
        }
        self.crawler.add_url(1, ridealong)

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop. Nothing to do here:
        pagination is chained from parse_and_save_news().
        '''


def _extract_title(article):
    '''
    News title: the first <strong> inside the formatted body, falling
    back to the first paragraph when no <strong> is present.
    '''
    body = article.find(class_='article-formatted-body')
    if body is None:
        return ''
    strong = body.find('strong')
    if strong is not None:
        return strong.get_text(' ', strip=True)
    p = body.find('p')
    return p.get_text(' ', strip=True) if p else ''


def parse_news_list_html(html):
    '''
    Parse a company news list page and return a list of news dicts:

        {'id', 'title', 'stats_counter', 'hubs',
         'score_counter', 'bookmarks_counter', 'comments_counter'}

    Returns an empty list when the page has no news (last page).
    '''
    soup = BeautifulSoup(html, 'lxml')

    news = []
    for article in soup.find_all('article', class_='tm-articles-list__item'):
        news_id_raw = article.get('id', '')
        if not NEWS_ID_RE.match(news_id_raw):
            continue
        news_id = int(news_id_raw)

        body = article.find(class_='article-formatted-body')
        if body is None:
            # not a full news snippet (ad block, pinned banner, etc.)
            continue

        title = _extract_title(article)

        # views: <span class="tm-icon-counter__value" title="3256">3.3K</span>
        stats_counter = None
        views_el = article.find('span', class_='tm-icon-counter__value')
        if views_el is not None:
            stats_counter = views_el.get('title') or views_el.get_text(strip=True)

        # hubs inside .tm-publication-hubs (the company blog link is kept
        # too, its code is the company code -- same as for articles)
        hubs = []
        hubs_container = article.find(class_='tm-publication-hubs')
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
                hub_title = habr_parse._normalize_hub_title(
                    a.get_text(' ', strip=True))
                if code:
                    hubs.append({'code': code, 'title': hub_title})

        # rating: .tm-votes-meter__value_rating ("+26", "−3")
        score_counter = None
        score_el = article.find(
            class_=lambda c: c and 'tm-votes-meter__value_rating' in c.split())
        if score_el is not None:
            score_counter = habr_parse._to_int(score_el.get_text(strip=True))

        bookmarks_counter = None
        bm_btn = article.find('button', class_='bookmarks-button')
        if bm_btn is not None:
            counter_el = bm_btn.find('span', class_='counter')
            if counter_el is not None:
                bookmarks_counter = habr_parse._to_int(
                    counter_el.get_text(strip=True))

        comments_counter = None
        comments_el = article.find('a', class_='article-comments-counter-link')
        if comments_el is not None:
            value_el = comments_el.find('span', class_='value')
            if value_el is not None:
                comments_counter = habr_parse._to_int(
                    value_el.get_text(strip=True))

        news.append({
            'id': news_id,
            'title': title,
            'stats_counter': stats_counter,
            'hubs': hubs,
            'score_counter': score_counter,
            'bookmarks_counter': bookmarks_counter,
            'comments_counter': comments_counter,
        })

    return news


async def parse_and_save_news(html, company_code, page, crawler=None):
    '''
    Parse one news list page and write news (+ hub links) to the
    database. Chains pagination: if the page contained news, the next
    page is queued via the crawler's news seed generator.

    Returns the number of news found on the page, or None on parse
    errors.
    '''
    try:
        news_items = parse_news_list_html(html)
    except Exception as e:
        LOGGER.warning('failed to parse news page %d for %s: %s',
                       page, company_code, e)
        stats.stats_sum('habr news parse errors', 1)
        return None

    stats.stats_sum('habr news pages parsed', 1)

    if not news_items:
        stats.stats_sum('habr news pages empty', 1)
        LOGGER.info('company %s: no news on page %d, pagination finished',
                    company_code, page)
        return 0

    saved = 0
    for news_item in news_items:
        inserted = await db.insert_news(
            news_id=news_item['id'],
            title=news_item['title'][:255],
            stats_counter=(news_item['stats_counter'] or '')[:255] or None,
            company_code=company_code,
            score_counter=news_item['score_counter'],
            bookmarks_counter=news_item['bookmarks_counter'],
            comments_counter=news_item['comments_counter'],
        )
        if inserted:
            saved += 1
            for hub in news_item['hubs']:
                hub_code = await db.get_or_create_hub(
                    hub['code'], hub['title'])
                await db.link_news_hub(news_item['id'], hub_code)

    stats.stats_sum('habr news saved', saved)
    LOGGER.info('company %s page %d: %d news found, %d saved',
                company_code, page, len(news_items), saved)

    # chain the next page: a full page means there may be more
    if crawler is not None:
        generator = getattr(crawler, 'habr_generator', None)
        if generator is not None and hasattr(generator, 'queue_news_page'):
            generator.queue_news_page(company_code, page + 1)
            stats.stats_sum('habr news urls queued', 1)

    return len(news_items)


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr news pages
    mode is on.
    '''
    generator = HabrNewsSeedGenerator(crawler)
    await generator.setup()
    return generator
