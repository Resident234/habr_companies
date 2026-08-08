'''
Seed generation and parsing for Habr company profile categories.

URLs follow the template:
    https://habr.com/ru/companies/{company}/profile/

Extracts industry categories from:
    <div class="tm-company-profile__categories">
        <span class="tm-company-profile__categories-wrapper">
            <a href="/ru/companies/category/software/"
               class="tm-company-profile__categories-text">Программное обеспечение</a>
        </span>
        ...
    </div>

Each category is stored in the `category` table (code taken from the url,
e.g. "software") and linked to the company via the `company_categories`
many-to-many table.
'''
import logging
import re

from bs4 import BeautifulSoup

from . import config
from . import db
from . import stats
from .urls import URL

LOGGER = logging.getLogger(__name__)

PROFILE_URL_TEMPLATE = 'https://habr.com/ru/companies/{company}/profile/'

# /ru/companies/category/telecom/ -> telecom
CATEGORY_HREF_RE = re.compile(r'/companies/category/(?P<code>[^/]+)/?')


class HabrCompanyProfileSeedGenerator:
    '''
    Lazily generates profile urls for every company in the database.
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'ProfileUrlTemplate') or PROFILE_URL_TEMPLATE
        self.companies = []
        self.index = 0
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        LOGGER.info('seeding %d company profiles', len(self.companies))
        self._queue_batch()

    def _queue_batch(self):
        '''
        Push all company profile urls into the scheduler.
        '''
        if self.exhausted:
            return

        retries_left = config.read('Crawl', 'MaxTries')
        queued = 0

        for company_code, _last_processed in self.companies:
            url = self.template.format(company=company_code)
            ridealong = {
                'url': URL(url),
                'priority': 1,
                'seed': True,
                'retries_left': retries_left,
                'seed_host': 'habr.com',
                'company_code': company_code,
                'profile_page': True,
            }
            self.crawler.add_url(1, ridealong)
            queued += 1

        stats.stats_sum('habr profile urls queued', queued)
        self.exhausted = True
        LOGGER.info('queued %d company profile urls', queued)

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop. Nothing to do here
        since all urls are queued at once.
        '''
        pass


def parse_company_link(html):
    '''
    Extract the company website url from the profile page element:
        <a class="tm-company-basic-info__link" href="http://www.ya.ru/"
           target="_blank">www.ya.ru</a>
    Returns the href string or None when the element is absent.
    '''
    soup = BeautifulSoup(html, 'lxml')
    a = soup.find('a', class_='tm-company-basic-info__link')
    if a is None:
        return None
    link = (a.get('href') or '').strip()
    return link or None


def parse_categories_html(html):
    '''
    Parse a company profile page and return a list of
    {'code': ..., 'title': ...} category dicts.
    '''
    soup = BeautifulSoup(html, 'lxml')
    container = soup.find('div', class_='tm-company-profile__categories')
    if container is None:
        return []

    categories = []
    for a in container.find_all('a', class_='tm-company-profile__categories-text'):
        href = a.get('href', '')
        m = CATEGORY_HREF_RE.search(href)
        if not m:
            continue
        code = m.group('code')
        title = a.get_text(strip=True)
        if code:
            categories.append({'code': code, 'title': title})
    return categories


async def parse_and_save_categories(html, company_code):
    '''
    Parse the profile page and write categories to the database.
    Also extracts the company website link
    (<a class="tm-company-basic-info__link" href="...">) and stores it
    in companies.link.
    Returns True if categories were saved.
    '''
    try:
        categories = parse_categories_html(html)
        link = parse_company_link(html)
    except Exception as e:
        LOGGER.warning('failed to parse profile for %s: %s', company_code, e)
        stats.stats_sum('habr profile parse errors', 1)
        return False

    if link:
        try:
            await db.update_company_link(company_code, link)
            stats.stats_sum('companies with link', 1)
            LOGGER.info('company %s: saved link %s', company_code, link)
        except Exception as e:
            LOGGER.warning('failed to save link for %s: %s', company_code, e)
            stats.stats_sum('habr link save errors', 1)
    else:
        stats.stats_sum('companies without link', 1)
        LOGGER.info('no website link found for company %s', company_code)

    if not categories:
        LOGGER.info('no categories found for company %s', company_code)
        stats.stats_sum('companies without categories', 1)
        return False

    for cat in categories:
        await db.get_or_create_category(cat['code'], cat['title'])
        await db.link_company_category(company_code, cat['code'])

    stats.stats_sum('companies with categories', 1)
    stats.stats_sum('company category links saved', len(categories))
    LOGGER.info('company %s: saved %d categories (%s)',
                company_code, len(categories),
                ', '.join(c['code'] for c in categories))
    return True


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr profile mode is on.
    '''
    generator = HabrCompanyProfileSeedGenerator(crawler)
    await generator.setup()
    return generator
