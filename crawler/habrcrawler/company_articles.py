'''
Seed generation and parsing for Habr company articles list pages.

Unlike individual article pages, company articles live on paginated list pages:

    https://habr.com/ru/companies/{company}/articles/
    https://habr.com/ru/companies/{company}/articles/page2/
    ...

Each page contains multiple article previews in
<article id="..." class="tm-articles-list__item ..."> blocks.

The article preview contains the article id, title, views counter,
hubs, score, bookmarks, and comments counters.

Pagination: one page per company is queued at a time. If the parsed
page still contains articles, the next page is queued from
parse_and_save_articles() (chaining); an empty page ends the walk.
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

ARTICLES_URL_TEMPLATE = 'https://habr.com/ru/companies/{company}/articles/'

# <article id="1026612" class="tm-articles-list__item ...">
ARTICLE_ID_RE = re.compile(r'^\d+$')
ARTICLE_URL_RE = re.compile(r'/ru/companies/[^/]+/articles/\d+')
ARTICLE_URL_TEMPLATE = (
    'https://habr.com/ru/companies/{company}/articles/{article_id}/'
)


def articles_page_url(template, company, page):
    '''
    Build the url of one articles page. Page 1 is the bare template,
    pages 2+ append 'page{N}/'.
    '''
    if page <= 1:
        return template.format(company=company)
    base = template.format(company=company)
    return urljoin(base, 'page{}/'.format(page))


class HabrArticlesSeedGenerator:
    '''
    Generates the first articles page url for every company in the
    database. Pagination is chained from the parser: if a parsed page
    still contains articles, the next page is queued from
    parse_and_save_articles() until a page comes back empty.
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'ArticlesUrlTemplate') or ARTICLES_URL_TEMPLATE
        self.companies = []
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        LOGGER.info('seeding articles pages for %d companies', len(self.companies))
        self._queue_batch()

    def _queue_batch(self):
        '''
        Push the first articles page of every company into the scheduler.
        '''
        if self.exhausted:
            return

        queued = 0
        for company_code, _last_processed in self.companies:
            self.queue_articles_page(company_code, 1)
            queued += 1

        stats.stats_sum('habr articles urls queued', queued)
        self.exhausted = True

    def queue_articles_page(self, company_code, page):
        '''Enqueue one articles page of one company.'''
        url = articles_page_url(self.template, company_code, page)
        ridealong = {
            'url': URL(url),
            'priority': 1,
            'seed': True,
            'retries_left': config.read('Crawl', 'MaxTries'),
            'seed_host': 'habr.com',
            'company_code': company_code,
            'articles_page': True,
            'articles_page_number': page,
        }
        self.crawler.add_url(1, ridealong)

    def queue_article_page(self, company_code, article_id, article_url=None,
                           hubs=None):
        '''Enqueue one article detail page discovered on a list page.'''
        if article_url is None:
            template = config.read('Habr', 'ArticleUrlTemplate') or \
                ARTICLE_URL_TEMPLATE
            article_url = template.format(
                company=company_code, article_id=article_id)

        ridealong = {
            'url': URL(article_url),
            'priority': 1,
            'retries_left': config.read('Crawl', 'MaxTries'),
            'seed_host': 'habr.com',
            'company_code': company_code,
            'article_id': article_id,
            'articles_detail_page': True,
            # Preserve every hub found in the list preview. The detail page is
            # authoritative when it contains the same code, but this fallback
            # prevents a partial detail response from dropping list hubs.
            'article_hubs': list(hubs or []),
        }
        self.crawler.add_url(1, ridealong)

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop. Nothing to do here:
        pagination is chained from parse_and_save_articles().
        '''


def _extract_title(article):
    '''
    Article title: the first <strong> inside the formatted body, falling
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


def _extract_article_url(article):
    '''Return the canonical detail URL linked from an article preview.'''
    link = article.find(
        'a', href=lambda href: href and ARTICLE_URL_RE.search(href))
    if link is None:
        return None
    return urljoin('https://habr.com', link.get('href', ''))


def parse_articles_list_html(html):
    '''
    Parse a company articles list page and return a list of article dicts:

        {'id', 'title', 'stats_counter', 'hubs',
         'score_counter', 'bookmarks_counter', 'comments_counter'}

    Returns an empty list when the page has no articles (last page).
    '''
    soup = BeautifulSoup(html, 'lxml')

    articles = []
    for article in soup.find_all('article', class_='tm-articles-list__item'):
        article_id_raw = article.get('id', '')
        if not ARTICLE_ID_RE.match(article_id_raw):
            continue
        article_id = int(article_id_raw)

        body = article.find(class_='article-formatted-body')
        if body is None:
            # not a full article snippet (ad block, pinned banner, etc.)
            continue

        # The preview text is not the article title. The canonical title is
        # read later from the h1 on the detail page. Keep the preview title
        # only as a fallback for malformed list entries.
        title = _extract_title(article)
        article_url = _extract_article_url(article)

        # views: <span class="tm-icon-counter__value" title="3256">3.3K</span>
        stats_counter = None
        views_el = article.find('span', class_='tm-icon-counter__value')
        if views_el is not None:
            stats_counter = views_el.get('title') or views_el.get_text(strip=True)

        # hubs inside .tm-publication-hubs (the company blog link is kept
        # too, its code is the company code -- same as for posts)
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

        articles.append({
            'id': article_id,
            'title': title,
            'url': article_url,
            'stats_counter': stats_counter,
            'hubs': hubs,
            'score_counter': score_counter,
            'bookmarks_counter': bookmarks_counter,
            'comments_counter': comments_counter,
        })

    return articles


async def parse_and_save_articles(html, company_code, page, crawler=None):
    '''
    Parse one articles list page and write articles (+ hub links) to the
    database. Chains pagination: if the page contained articles, the next
    page is queued via the crawler's articles seed generator.

    Returns the number of articles found on the page, or None on parse
    errors.
    '''
    try:
        articles = parse_articles_list_html(html)
    except Exception as e:
        LOGGER.warning('failed to parse articles page %d for %s: %s',
                       page, company_code, e)
        stats.stats_sum('habr articles parse errors', 1)
        return None

    stats.stats_sum('habr articles pages parsed', 1)

    if not articles:
        stats.stats_sum('habr articles pages empty', 1)
        LOGGER.info('company %s: no articles on page %d, pagination finished',
                    company_code, page)
        return 0

    queued = 0
    saved = 0
    for article in articles:
        if crawler is not None:
            generator = getattr(crawler, 'habr_generator', None)
            if generator is not None and hasattr(generator, 'queue_article_page'):
                generator.queue_article_page(
                    company_code, article['id'], article.get('url'),
                    article.get('hubs'))
            else:
                template = config.read('Habr', 'ArticleUrlTemplate') or \
                    ARTICLE_URL_TEMPLATE
                detail_url = article.get('url') or template.format(
                    company=company_code, article_id=article['id'])
                crawler.add_url(1, {
                    'url': URL(detail_url),
                    'priority': 1,
                    'retries_left': config.read('Crawl', 'MaxTries'),
                    'seed_host': 'habr.com',
                    'company_code': company_code,
                    'article_id': article['id'],
                    'articles_detail_page': True,
                    'article_hubs': list(article.get('hubs') or []),
                })
            queued += 1
            continue

        # Keep the parser's standalone fallback for callers without a crawler.
        inserted = await db.insert_article(
            article_id=article['id'],
            title=article['title'][:255],
            stats_counter=(article['stats_counter'] or '')[:255] or None,
            label_id=None,  # articles list doesn't have label info
            company_code=company_code,
            score_counter=article['score_counter'],
            bookmarks_counter=article['bookmarks_counter'],
            comments_counter=article['comments_counter'],
        )
        if inserted:
            saved += 1

        # Existing article rows may still be missing relations, so this must
        # run for both inserts and updates.
        for hub in article['hubs']:
            hub_code = await db.get_or_create_hub(
                hub['code'], hub['title'])
            await db.link_article_hub(article['id'], hub_code)

    stats.stats_sum('habr articles detail urls queued', queued)
    stats.stats_sum('habr articles saved', saved)
    LOGGER.info(
        'company %s page %d: %d articles found, %d detail urls queued, %d saved',
        company_code, page, len(articles), queued, saved)

    # chain the next page: a full page means there may be more
    if crawler is not None:
        generator = getattr(crawler, 'habr_generator', None)
        if generator is not None and hasattr(generator, 'queue_articles_page'):
            generator.queue_articles_page(company_code, page + 1)
            stats.stats_sum('habr articles urls queued', 1)

    return len(articles)


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr articles mode
    is on.
    '''
    generator = HabrArticlesSeedGenerator(crawler)
    await generator.setup()
    return generator
