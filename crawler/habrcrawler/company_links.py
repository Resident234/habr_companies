'''
Seed generation and parsing for Habr company profile widget links.

URLs follow the template:
    https://habr.com/ru/companies/{company}/profile/

Extracts links from:
    <ul class="tm-widget-links__list">
        <a class="tm-widget-links__link" 
           href="https://example.com" 
           rel="nofollow noreferrer" 
           target="_blank" 
           title="Link title">Link text</a>
    </ul>

Each link is stored as a JSON object in the companies.links column:
    [
        {"href": "...", "title": "...", "rel": ["..."], "target": "..."},
        ...
    ]
'''
import json
import logging

from bs4 import BeautifulSoup

from . import config
from . import db
from . import stats
from .urls import URL

LOGGER = logging.getLogger(__name__)

PROFILE_URL_TEMPLATE = 'https://habr.com/ru/companies/{company}/profile/'


class HabrCompanyLinksSeedGenerator:
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
        LOGGER.info('seeding %d company profile pages for widget links', len(self.companies))
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
                'links_page': True,
            }
            self.crawler.add_url(1, ridealong)
            queued += 1

        stats.stats_sum('habr links urls queued', queued)
        self.exhausted = True
        LOGGER.info('queued %d company profile urls for widget links', queued)

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop. Nothing to do here
        since all urls are queued at once.
        '''
        pass


def parse_links_html(html):
    '''
    Parse a company profile page and return a list of link dicts.
    Each dict contains: href, title, rel (list), target.
    '''
    soup = BeautifulSoup(html, 'lxml')
    # Try ul first, then div (some pages might use different container)
    container = soup.find('ul', class_='tm-widget-links__list')
    if container is None:
        container = soup.find('div', class_='tm-widget-links__list')
    if container is None:
        return []

    links = []
    for a in container.find_all('a', class_='tm-widget-links__link'):
        href = (a.get('href') or '').strip()
        if not href:
            continue
        title = (a.get('title') or '').strip()
        if not title:
            title = a.get_text(strip=True)
        rel = a.get('rel', [])
        if isinstance(rel, str):
            rel = [rel]
        elif not isinstance(rel, list):
            rel = []
        target = (a.get('target') or '').strip()
        links.append({
            'href': href,
            'title': title,
            'rel': rel,
            'target': target,
        })
    return links


async def parse_and_save_links(html, company_code):
    '''
    Parse the profile page and write widget links to the database as JSON.
    Returns True if links were saved.
    '''
    try:
        links = parse_links_html(html)
    except Exception as e:
        LOGGER.warning('failed to parse widget links for %s: %s', company_code, e)
        stats.stats_sum('habr links parse errors', 1)
        return False

    if not links:
        LOGGER.info('no widget links found for company %s', company_code)
        stats.stats_sum('companies without widget links', 1)
        return False

    try:
        links_json = json.dumps(links, ensure_ascii=False)
        await db.update_company_links(company_code, links_json)
        stats.stats_sum('companies with widget links', 1)
        stats.stats_sum('company widget links saved', len(links))
        LOGGER.info('company %s: saved %d widget links', company_code, len(links))
    except Exception as e:
        LOGGER.warning('failed to save widget links for %s: %s', company_code, e)
        stats.stats_sum('habr links save errors', 1)
        return False

    return True


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr links mode is on.
    '''
    generator = HabrCompanyLinksSeedGenerator(crawler)
    await generator.setup()
    return generator
