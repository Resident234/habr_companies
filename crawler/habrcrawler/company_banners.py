'''
Seed generation and parsing for Habr company profile banner links.

URLs follow the template:
    https://habr.com/ru/companies/{company}/profile/

Extracts hrefs from:
    <div class="swiper-wrapper">
        <a class="tm-widget-banner-content__image-wrapper" href="https://...">
    </div>

or, when there is only a single banner:
    <div class="tm-widget-banner-content">
        <a class="tm-widget-banner-content__image-wrapper" href="https://...">
    </div>

Each href is stored as a JSON object in the companies.links column,
appended to any existing links while preserving the original format
of the previously saved items:
    [
        {"href": "...", "title": "...", ...},  # existing items preserved
        {"href": "https://t.me/..."},           # new banner href
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

BANNERS_URL_TEMPLATE = 'https://habr.com/kek/v2/companies/{company}/widgets/?fl=ru&hl=ru'

class HabrCompanyBannersSeedGenerator:
    '''
    Lazily generates widgets API urls for every company in the database.
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'BannersUrlTemplate') or BANNERS_URL_TEMPLATE
        self.companies = []
        self.index = 0
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        LOGGER.info('seeding %d company profile pages for banner links',
                    len(self.companies))
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
                'banners_page': True,
            }
            self.crawler.add_url(1, ridealong)
            queued += 1

        stats.stats_sum('habr banners urls queued', queued)
        self.exhausted = True
        LOGGER.info('queued %d company profile urls for banner links', queued)

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop. Nothing to do here
        since all urls are queued at once.
        '''
        pass


def parse_banners_html(html):
    '''
    Parse a company widgets API response and return a list of banner href dicts.
    Each dict contains: href.
    
    Fallback: if the response is HTML instead of JSON, it attempts to extract 
    banners from the HTML directly.
    '''
    links = []
    if not html or not html.strip():
        return []
        
    try:
        data = json.loads(html)
        
        widget_refs = data.get('widgetRefs', [])
        if not widget_refs:
            return []

        seen = set()
        for widget in widget_refs:
            if widget.get('type') == 'banner':
                widget_data = widget.get('data', {})
                href = (widget_data.get('imageLinkUrl') or '').strip()
                if not href:
                    continue
                if href in seen:
                    continue
                seen.add(href)
                links.append({'href': href})
        return links
        
    except json.JSONDecodeError:
        # Not JSON. If it looks like HTML, fallback to parsing HTML
        if '<html' in html.lower() or '<!doctype html' in html.lower():
            soup = BeautifulSoup(html, 'lxml')
            
            # Try multiple banners inside swiper-wrapper first
            swiper = soup.find('div', class_='swiper-wrapper')
            if swiper is not None:
                anchors = swiper.find_all(
                    'a', class_='tm-widget-banner-content__image-wrapper')
            else:
                # Fallback: single banner container without swiper-wrapper
                banner = soup.find('div', class_='tm-widget-banner-content')
                if banner is None:
                    return []
                anchors = banner.find_all(
                    'a', class_='tm-widget-banner-content__image-wrapper')

            seen = set()
            for a in anchors:
                href = (a.get('href') or '').strip()
                if not href:
                    continue
                if href in seen:
                    continue
                seen.add(href)
                links.append({'href': href})
            return links
            
        snippet = repr(html[:100])
        LOGGER.warning('failed to decode JSON from widgets API and not HTML. Content: %s', snippet)
        return []


async def _merge_banner_links(company_code, new_links):
    '''
    Read existing links from DB, append new banner hrefs that are not
    already present, and write the merged array back.
    Returns True if the DB was updated.
    '''
    try:
        existing_json = await db.get_company_links(company_code)
    except Exception as e:
        LOGGER.warning('failed to load existing links for %s: %s',
                       company_code, e)
        existing_json = None

    existing = []
    if existing_json:
        try:
            existing = json.loads(existing_json)
            if not isinstance(existing, list):
                existing = [existing]
        except (json.JSONDecodeError, TypeError):
            existing = []

    existing_hrefs = set()
    for item in existing:
        if isinstance(item, dict):
            href = (item.get('href') or '').strip()
            if href:
                existing_hrefs.add(href)

    merged = list(existing)
    added = 0
    for link in new_links:
        href = link.get('href', '')
        if href and href not in existing_hrefs:
            merged.append(link)
            existing_hrefs.add(href)
            added += 1

    if not added:
        return False

    links_json = json.dumps(merged, ensure_ascii=False)
    await db.update_company_links(company_code, links_json)
    return True


async def parse_and_save_banners(html, company_code):
    '''
    Parse the profile page for banner links and merge them into the
    existing companies.links JSON column.

    Returns True if any new links were saved.
    '''
    try:
        links = parse_banners_html(html)
    except Exception as e:
        LOGGER.warning('failed to parse banner links for %s: %s',
                       company_code, e)
        stats.stats_sum('habr banners parse errors', 1)
        return False

    if not links:
        LOGGER.info('no banner links found for company %s', company_code)
        stats.stats_sum('companies without banner links', 1)
        return False

    try:
        saved = await _merge_banner_links(company_code, links)
    except Exception as e:
        LOGGER.warning('failed to save banner links for %s: %s',
                       company_code, e)
        stats.stats_sum('habr banners save errors', 1)
        return False

    if saved:
        stats.stats_sum('companies with banner links', 1)
        stats.stats_sum('company banner links saved', len(links))
        LOGGER.info('company %s: saved %d banner links', company_code, len(links))

    return saved


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr banners mode is on.
    '''
    generator = HabrCompanyBannersSeedGenerator(crawler)
    await generator.setup()
    return generator
