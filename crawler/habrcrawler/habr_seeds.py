'''
Seed generation for the Habr companies article parser.

URLs follow the template:
    https://habr.com/ru/companies/{company}/articles/{article_id}/

The full id range (1..10M by default) per company is far too large to
put into the scheduler queue at once, so generation is lazy: we keep a
bounded window of queued urls and top it up as the queue drains.
'''
import logging

from . import config
from . import db
from . import stats
from .urls import URL

LOGGER = logging.getLogger(__name__)


class HabrSeedGenerator:
    '''
    Lazily generates article urls for every company in the database.
    '''

    def __init__(self, crawler):
        self.crawler = crawler
        self.template = config.read(
            'Habr', 'UrlTemplate') or \
            'https://habr.com/ru/companies/{company}/articles/{article_id}/'
        self.id_start = int(config.read('Habr', 'ArticleIdStart') or 1)
        self.id_end = int(config.read('Habr', 'ArticleIdEnd') or 10000000)
        self.batch_size = int(config.read('Habr', 'SeedBatchSize') or 20000)
        self.companies = []
        # Round-robin state: track next_id for each company separately
        self.company_next_ids = {}  # {company_code: next_article_id}
        self.company_order = []     # list of company codes in round-robin order
        self.rr_index = 0           # current position in round-robin cycle
        self.exhausted = False

    async def setup(self):
        self.companies = await db.get_companies()
        if not self.companies:
            LOGGER.error('no companies found in database, nothing to crawl')
            self.exhausted = True
            return
        # Initialize round-robin state. Each company continues from its
        # saved progress (last_processed_article_id + 1), falling back to
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
                           '(up to id %d)', self.id_end)
            self.exhausted = True
            return
        LOGGER.info('seeding %d companies (resumed %d from saved progress), '
                    'article ids %d..%d (round-robin)',
                    len(self.company_order), resumed, self.id_start, self.id_end)
        self._queue_batch()

    def _next_company_round_robin(self):
        '''
        Return the next company in round-robin order, or None if all
        companies have exhausted their id ranges.
        '''
        if not self.company_order:
            return None

        # Find next company that still has ids to generate
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
        one article id from each company in turn, so progress is uniform
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

            article_id = self.company_next_ids[company]
            self.company_next_ids[company] = article_id + 1

            # Advance round-robin index for next call
            self.rr_index = (self.rr_index + 1) % len(self.company_order)

            url = self.template.format(company=company, article_id=article_id)
            ridealong = {
                'url': URL(url),
                'priority': 1,
                'seed': True,
                'retries_left': retries_left,
                'seed_host': 'habr.com',
                'company_code': company,
                'article_id': article_id,
            }
            self.crawler.add_url(1, ridealong)
            queued += 1

        stats.stats_sum('habr urls queued', queued)
        LOGGER.debug('queued batch of %d urls (round-robin, %d companies active)',
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
    Replacement for seeds.expand_seeds_config() when Habr mode is on.
    '''
    generator = HabrSeedGenerator(crawler)
    await generator.setup()
    return generator
