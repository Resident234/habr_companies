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
    Returns a list of company codes from the companies table.
    '''
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute('SELECT code FROM companies')
            rows = await cur.fetchall()
    companies = [r[0] for r in rows]
    LOGGER.info('loaded %d companies from database', len(companies))
    return companies


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
    return await _get_or_create('hubs', code, title, _hub_cache)


async def get_or_create_label(code, title):
    '''
    The labels table has no `code` column (only id + title), so we look
    up by title. `code` is kept in the signature for API symmetry and
    logging.
    '''
    if title in _label_cache:
        return _label_cache[title]

    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute('SELECT id FROM labels WHERE title = %s', (title,))
            row = await cur.fetchone()
            if row:
                _label_cache[title] = row[0]
                return row[0]
            await cur.execute('INSERT INTO labels (title) VALUES (%s)', (title,))
            _label_cache[title] = cur.lastrowid
            stats.stats_sum('labels created', 1)
            LOGGER.info('created label: code=%s title=%s', code, title)
            return cur.lastrowid



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
                    '(id, title, stats_counter, hub, label, company, '
                    ' score_counter, bookmarks_counter, comments_counter) '
                    'VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)',
                    (article_id, title, stats_counter, None, label_id,
                     company_code, score_counter, bookmarks_counter,
                     comments_counter))
                stats.stats_sum('articles inserted', 1)
                return True
            except Exception as e:
                if 'Duplicate entry' in str(e):
                    stats.stats_sum('articles duplicate skipped', 1)
                    return False
                raise


async def link_article_hub(article_id, hub_id):
    pool = await init_pool()
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            await cur.execute(
                'INSERT IGNORE INTO article_hubs (article_id, hub_id) '
                'VALUES (%s, %s)',
                (article_id, hub_id))
