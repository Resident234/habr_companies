'''
Seed generation and parsing for Habr company posts.

Unlike articles, posts have no standalone pages of their own to crawl:
a company's post list lives on a single paginated page:

    https://habr.com/ru/companies/{company}/posts/
    https://habr.com/ru/companies/{company}/posts/page2/
    ...

Each page contains up to 20 posts in
<article id="..." class="tm-articles-list__item ..."> blocks.

The whole post (title, text, hubs, tags, counters) is present in the
list markup, so everything is extracted from the list page itself.

Pagination: one page per company is queued at a time. If the parsed
page still contains posts, the next page is queued from
parse_and_save_posts() (chaining); an empty page ends the walk.
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

POSTS_URL_TEMPLATE = 'https://habr.com/ru/companies/{company}/posts/'

# <article id="1026612" class="tm-articles-list__item ...">
ARTICLE_ID_RE = re.compile(r'^\d+$')


def posts_page_url(template, company, page):
    '''
    Build the url of one posts page. Page 1 is the bare template,
    pages 2+ append 'page{N}/'.
    '''
    if page <= 1:
        return template.format(company=company)
    base = template.format(company=company)
    return urljoin(base, 'page{}/'.format(page))


class HabrPostsSeedGenerator:
    '''
    Generates the first posts page url for every company in the
    database. Pagination is chained from the parser: if a parsed page
    still contains posts, the next page is queued from
    parse_and_save_posts() until a page comes back empty.
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'PostsUrlTemplate') or POSTS_URL_TEMPLATE
        self.companies = []
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        LOGGER.info('seeding posts pages for %d companies', len(self.companies))
        self._queue_batch()

    def _queue_batch(self):
        '''
        Push the first posts page of every company into the scheduler.
        '''
        if self.exhausted:
            return

        queued = 0
        for company_code, _last_processed in self.companies:
            self.queue_posts_page(company_code, 1)
            queued += 1

        stats.stats_sum('habr post urls queued', queued)
        self.exhausted = True

    def queue_posts_page(self, company_code, page):
        '''Enqueue one posts page of one company.'''
        url = posts_page_url(self.template, company_code, page)
        ridealong = {
            'url': URL(url),
            'priority': 1,
            'seed': True,
            'retries_left': config.read('Crawl', 'MaxTries'),
            'seed_host': 'habr.com',
            'company_code': company_code,
            'posts_page': True,
            'posts_page_number': page,
        }
        self.crawler.add_url(1, ridealong)

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop. Nothing to do here:
        pagination is chained from parse_and_save_posts().
        '''


def _extract_title(article):
    '''
    Post title: the first <strong> inside the formatted body, falling
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


def parse_posts_list_html(html):
    '''
    Parse a company posts list page and return a list of post dicts:

        {'id', 'title', 'stats_counter', 'hubs',
         'score_counter', 'bookmarks_counter', 'comments_counter'}

    Returns an empty list when the page has no posts (last page).
    '''
    soup = BeautifulSoup(html, 'lxml')

    posts = []
    for article in soup.find_all('article', class_='tm-articles-list__item'):
        post_id_raw = article.get('id', '')
        if not ARTICLE_ID_RE.match(post_id_raw):
            continue
        post_id = int(post_id_raw)

        body = article.find(class_='article-formatted-body')
        if body is None:
            # not a full post snippet (ad block, pinned banner, etc.)
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

        posts.append({
            'id': post_id,
            'title': title,
            'stats_counter': stats_counter,
            'hubs': hubs,
            'score_counter': score_counter,
            'bookmarks_counter': bookmarks_counter,
            'comments_counter': comments_counter,
        })

    return posts



async def parse_and_save_posts(html, company_code, page, crawler=None):
    '''
    Parse one posts list page and write posts (+ hub links) to the
    database. Chains pagination: if the page contained posts, the next
    page is queued via the crawler's posts seed generator.

    Returns the number of posts found on the page, or None on parse
    errors.
    '''
    try:
        posts = parse_posts_list_html(html)
    except Exception as e:
        LOGGER.warning('failed to parse posts page %d for %s: %s',
                       page, company_code, e)
        stats.stats_sum('habr posts parse errors', 1)
        return None

    stats.stats_sum('habr posts pages parsed', 1)

    if not posts:
        stats.stats_sum('habr posts pages empty', 1)
        LOGGER.info('company %s: no posts on page %d, pagination finished',
                    company_code, page)
        return 0

    saved = 0
    for post in posts:
        inserted = await db.insert_post(
            post_id=post['id'],
            title=post['title'][:255],
            stats_counter=(post['stats_counter'] or '')[:255] or None,
            company_code=company_code,
            score_counter=post['score_counter'],
            bookmarks_counter=post['bookmarks_counter'],
            comments_counter=post['comments_counter'],
        )
        if inserted:
            saved += 1
            for hub in post['hubs']:
                hub_code = await db.get_or_create_hub(
                    hub['code'], hub['title'])
                await db.link_post_hub(post['id'], hub_code)

    stats.stats_sum('habr posts saved', saved)
    LOGGER.info('company %s page %d: %d posts found, %d saved',
                company_code, page, len(posts), saved)

    # chain the next page: a full page means there may be more
    if crawler is not None:
        generator = getattr(crawler, 'habr_generator', None)
        if generator is not None and hasattr(generator, 'queue_posts_page'):
            generator.queue_posts_page(company_code, page + 1)
            stats.stats_sum('habr post urls queued', 1)

    return len(posts)


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr posts mode
    is on.
    '''
    generator = HabrPostsSeedGenerator(crawler)
    await generator.setup()
    return generator

