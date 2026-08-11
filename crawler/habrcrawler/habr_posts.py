'''
Seed generation for the Habr companies post pages parser.

URLs follow the template:
    https://habr.com/ru/companies/{company}/posts/{post_id}/

Works exactly like habr_seeds.py (articles), but iterates post ids and
tracks per-company progress in companies.last_processed_post_id.
'''
import logging

from . import config
from . import db
from . import stats
from .urls import URL

LOGGER = logging.getLogger(__name__)

POST_PAGE_URL_TEMPLATE = 'https://habr.com/ru/companies/{company}/posts/{post_id}/'


class HabrPostPagesSeedGenerator:
    '''
    Lazily generates post page urls for every company in the database,
    round-robin across companies (same mechanics as HabrSeedGenerator).
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'PostUrlTemplate') or POST_PAGE_URL_TEMPLATE
        self.id_start = int(config.read('Habr', 'PostIdStart') or 1)
        self.id_end = int(config.read('Habr', 'PostIdEnd') or 10000000)
        self.batch_size = int(config.read('Habr', 'SeedBatchSize') or 20000)
        self.companies = []
        # Round-robin state: track next_id for each company separately
        self.company_next_ids = {}  # {company_code: next_post_id}
        self.company_order = []     # list of company codes in round-robin order
        self.rr_index = 0           # current position in round-robin cycle
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies_posts_progress()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        # Initialize round-robin state. Each company continues from its
        # saved progress (last_processed_post_id + 1), falling back to
        # id_start for companies never crawled before.
        resumed = 0
        self.company_order = []
        self.company_next_ids = {}
        for code, last_processed in self.companies:
            if last_processed is not None:
                next_id = int(last_processed) + 1
                resumed += 1
            else:
                next_id = self.id_start
            if next_id <= self.id_end:
                self.company_order.append(code)
                self.company_next_ids[code] = next_id
        self.rr_index = 0
        if not self.company_order:
            LOGGER.warning('all companies are already fully crawled '
                           '(up to post id %d)', self.id_end)
            self.exhausted = True
            return
        LOGGER.info('seeding %d companies (resumed %d from saved progress), '
                    'post ids %d..%d (round-robin)',
                    len(self.company_order), resumed, self.id_start, self.id_end)
        self._queue_batch()

    def _next_company_round_robin(self):
        '''
        Return the next company in round-robin order, or None if all
        companies have exhausted their id ranges.
        '''
        if not self.company_order:
            return None

        attempts = 0
        while attempts < len(self.company_order):
            company = self.company_order[self.rr_index]
            next_id = self.company_next_ids[company]

            if next_id <= self.id_end:
                return company

            # This company is exhausted, move to next
            self.rr_index = (self.rr_index + 1) % len(self.company_order)
            attempts += 1

        # All companies exhausted
        return None

    def _queue_batch(self):
        '''
        Push up to batch_size urls into the scheduler using round-robin:
        one post id from each company in turn, so progress is uniform
        across all companies. Sets self.exhausted when everything has
        been queued.
        '''
        if self.exhausted:
            return

        retries_left = config.read('Crawl', 'MaxTries')
        queued = 0

        while queued < self.batch_size:
            company = self._next_company_round_robin()
            if company is None:
                self.exhausted = True
                break

            post_id = self.company_next_ids[company]
            self.company_next_ids[company] = post_id + 1

            # Advance round-robin index for next call
            self.rr_index = (self.rr_index + 1) % len(self.company_order)

            url = self.template.format(company=company, post_id=post_id)
            ridealong = {
                'url': URL(url),
                'priority': 1,
                'seed': True,
                'retries_left': retries_left,
                'seed_host': 'habr.com',
                'company_code': company,
                'post_id': post_id,
            }
            self.crawler.add_url(1, ridealong)
            queued += 1

        stats.stats_sum('habr post page urls queued', queued)
        LOGGER.debug('queued batch of %d post page urls (round-robin, %d companies active)',
                     queued, len(self.company_order))

    def maybe_top_up(self):
        '''
        Called periodically from the crawl loop: if the queue is running
        low and we still have urls to generate, queue another batch.
        '''
        if self.exhausted:
            return
        try:
            qlen = self.crawler.scheduler.q.qsize()
        except Exception:
            return

        if qlen < self.batch_size // 2:
            self._queue_batch()


async def seed_from_database(crawler):
    '''
    Replacement for seeds.expand_seeds_config() when Habr post pages
    mode is on.
    '''
    generator = HabrPostPagesSeedGenerator(crawler)
    await generator.setup()
    return generator
