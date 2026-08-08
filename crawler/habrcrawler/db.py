'''
Async MySQL layer for the Habr companies article parser.

Uses aiomysql so database work fits into habrcrawler's asyncio architecture.
All lookups of hubs/labels are cached in memory to avoid repeated
SELECT round-trips.
'''
import logging

import aiomysql

from . import config
from . import stats

LOGGER = logging.getLogger(__name__)

_pool = None

# in-memory caches: code -> id
_hub_cache = {}
_label_cache = {}
_category_cache = {}


async def init_pool():
    global _pool
    if _pool is not None:
        return _pool
    min_pool_size = int(config.read('Database', 'MinPoolSize') or 1)
    max_pool_size = int(config.read('Database', 'MaxPoolSize') or 10)
    if max_pool_size < min_pool_size:
        raise ValueError(
            'Database.MaxPoolSize ({}) must be >= Database.MinPoolSize ({})'
            .format(max_pool_size, min_pool_size))
    _pool = await aiomysql.create_pool(
        host=config.read('Database', 'Host'),
        port=int(config.read('Database', 'Port') or 3306),
        user=config.read('Database', 'User'),
        password=config.read('Database', 'Password') or '',
        db=config.read('Database', 'Name'),
        charset='utf8mb4',
        autocommit=True,
        minsize=min_pool_size,
        maxsize=max_pool_size,
    )
    LOGGER.info('MySQL pool created for db %s (min=%d, max=%d)',
                config.read('Database', 'Name'), min_pool_size, max_pool_size)
    return _pool


async def close_pool():
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None


async def get_companies():
    '''
    Returns a list of (company_code, last_processed_article_id) tuples
    from the companies table. last_processed_article_id is None for
    companies that have not been crawled yet.
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'SELECT code, last_processed_article_id FROM companies')
            rows = await cur.fetchall()
    companies = [(r[0], r[1]) for r in rows]
    LOGGER.info('loaded %d companies from database', len(companies))
    return companies


async def get_companies_news_progress():
    '''
    Returns a list of (company_code, last_processed_news_id) tuples
    from the companies table. last_processed_news_id is None for
    companies whose news have not been crawled yet.
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'SELECT code, last_processed_news_id FROM companies')
            rows = await cur.fetchall()
    companies = [(r[0], r[1]) for r in rows]
    LOGGER.info('loaded %d companies from database', len(companies))
    return companies


async def update_company_progress(code, article_id):
    '''
    Record the article_id last processed for a company. Uses GREATEST so a
    concurrently processed lower article_id can never roll the progress back.
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'UPDATE companies '
                'SET last_processed_article_id = '
                '    GREATEST(COALESCE(last_processed_article_id, 0), %s) '
                'WHERE code = %s',
                (article_id, code))


async def _get_or_create(table, code, title, cache):
    '''
    Find row id by code in table; insert if missing. Cached in memory.
    '''
    if code in cache:
        return cache[code]

    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(f'SELECT id FROM {table} WHERE code = %s', (code,))
            row = await cur.fetchone()
            if row:
                cache[code] = row[0]
                return row[0]
            await cur.execute(
                f'INSERT INTO {table} (code, title) VALUES (%s, %s)',
                (code, title))
            cache[code] = cur.lastrowid
            stats.stats_sum(f'{table} created', 1)
            LOGGER.info('created %s: code=%s title=%s', table, code, title)
            return cur.lastrowid


async def get_or_create_hub(code, title):
    '''
    Find hub by code; insert if missing. Returns hub code (string).
    Hubs table uses `code` as primary key, so we return the code itself
    rather than a numeric id.
    '''
    if code in _hub_cache:
        return _hub_cache[code]

    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute('SELECT code FROM hubs WHERE code = %s', (code,))
            row = await cur.fetchone()
            if row:
                _hub_cache[code] = row[0]
                return row[0]
            await cur.execute(
                'INSERT INTO hubs (code, title) VALUES (%s, %s)',
                (code, title))
            _hub_cache[code] = code
            stats.stats_sum('hubs created', 1)
            LOGGER.info('created hub: code=%s title=%s', code, title)
            return code


async def get_or_create_label(code, title):
    '''
    Ensure a label row exists and return its code (string).
    Labels table now uses `code` as primary key. If `code` is missing,
    derive a safe code from the title.
    '''
    # Normalize/derive code
    code = (code or '').strip()
    if not code:
        # derive from title: lowercase, replace non-word with underscore
        import re
        code = re.sub(r'\W+', '_', (title or '').strip().lower())

    if code in _label_cache:
        return _label_cache[code]

    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute('SELECT code FROM labels WHERE code = %s', (code,))
            row = await cur.fetchone()
            if row:
                _label_cache[code] = row[0]
                return row[0]
            await cur.execute('INSERT INTO labels (code, title) VALUES (%s, %s)', (code, title))
            _label_cache[code] = code
            stats.stats_sum('labels created', 1)
            LOGGER.info('created label: code=%s title=%s', code, title)
            return code



async def insert_article(article_id, title, stats_counter, label_id,
                         company_code, score_counter, bookmarks_counter,
                         comments_counter):
    '''
    Insert one article row. Returns True if inserted, False if it already
    existed (duplicate id).
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(
                    'INSERT INTO articles '
                    '(id, title, stats_counter, label, company, '
                    ' score_counter, bookmarks_counter, comments_counter) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s, %s)',
                    (article_id, title, stats_counter, label_id,
                     company_code, score_counter, bookmarks_counter,
                     comments_counter))
                stats.stats_sum('articles inserted', 1)
                return True
            except Exception as e:
                if 'Duplicate entry' in str(e):
                    stats.stats_sum('articles duplicate skipped', 1)
                    return False
                raise


async def link_article_hub(article_id, hub_code):
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'INSERT IGNORE INTO article_hubs (article_id, hub_code) '
                'VALUES (%s, %s)',
                (article_id, hub_code))


async def insert_post(post_id, title, stats_counter, company_code,
                      score_counter, bookmarks_counter, comments_counter):
    '''
    Insert one post row. Returns True if inserted, False if it already
    existed (duplicate id).
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(
                    'INSERT INTO posts '
                    '(id, title, stats_counter, company, '
                    ' score_counter, bookmarks_counter, comments_counter) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s)',
                    (post_id, title, stats_counter, company_code,
                     score_counter, bookmarks_counter, comments_counter))
                stats.stats_sum('posts inserted', 1)
                return True
            except Exception as e:
                if 'Duplicate entry' in str(e):
                    stats.stats_sum('posts duplicate skipped', 1)
                    return False
                raise


async def link_post_hub(post_id, hub_code):
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'INSERT IGNORE INTO post_hubs (post_id, hub_code) '
                'VALUES (%s, %s)',
                (post_id, hub_code))


async def insert_news(news_id, title, stats_counter, company_code,
                      score_counter, bookmarks_counter, comments_counter):
    '''
    Insert one news row. Returns True if inserted, False if it already
    existed (duplicate id).
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            try:
                await cur.execute(
                    'INSERT INTO news '
                    '(id, title, stats_counter, company, '
                    ' score_counter, bookmarks_counter, comments_counter) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s)',
                    (news_id, title, stats_counter, company_code,
                     score_counter, bookmarks_counter, comments_counter))
                stats.stats_sum('news inserted', 1)
                return True
            except Exception as e:
                if 'Duplicate entry' in str(e):
                    stats.stats_sum('news duplicate skipped', 1)
                    return False
                raise


async def link_news_hub(news_id, hub_code):
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'INSERT IGNORE INTO news_hubs (news_id, hub_code) '
                'VALUES (%s, %s)',
                (news_id, hub_code))


async def update_company_news_progress(code, news_id):
    '''
    Record the news_id last processed for a company. Uses GREATEST so a
    concurrently processed lower news_id can never roll the progress back.
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'UPDATE companies '
                'SET last_processed_news_id = '
                '    GREATEST(COALESCE(last_processed_news_id, 0), %s) '
                'WHERE code = %s',
                (news_id, code))


async def update_company_link(code, link):
    '''
    Store the company website url extracted from the profile page
    (<a class="tm-company-basic-info__link" href="...">).
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'UPDATE companies SET link = %s WHERE code = %s',
                (link, code))


async def get_or_create_category(code, title):
    '''
    Ensure a category row exists and return its code (string).
    Category table uses `code` as primary key.
    '''
    code = (code or '').strip()
    if not code:
        return None

    if code in _category_cache:
        return _category_cache[code]

    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute('SELECT code FROM category WHERE code = %s', (code,))
            row = await cur.fetchone()
            if row:
                _category_cache[code] = row[0]
                return row[0]
            await cur.execute(
                'INSERT INTO category (code, title) VALUES (%s, %s)',
                (code, title))
            _category_cache[code] = code
            stats.stats_sum('categories created', 1)
            LOGGER.info('created category: code=%s title=%s', code, title)
            return code


async def link_company_category(company_code, category_code):
    '''
    Link a company to a category in the company_categories table.
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'INSERT IGNORE INTO company_categories (company_code, category_code) '
                'VALUES (%s, %s)',
                (company_code, category_code))
