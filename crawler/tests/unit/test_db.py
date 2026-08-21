import asyncio

import pytest

import habrcrawler.db as db


class AsyncContext:
    def __init__(self, value):
        self.value = value

    async def __aenter__(self):
        return self.value

    async def __aexit__(self, exc_type, exc, tb):
        return False


class FakeCursor:
    def __init__(self, rowcount):
        self.rowcount = rowcount
        self.query = None
        self.params = None

    async def execute(self, query, params):
        self.query = query
        self.params = params


class HubCursor:
    def __init__(self, row):
        self.row = row
        self.executed = []

    async def execute(self, query, params):
        self.executed.append((query, params))

    async def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, cursor):
        self.cursor_instance = cursor

    def cursor(self):
        return AsyncContext(self.cursor_instance)


class FakePool:
    def __init__(self, cursor):
        self.connection = FakeConnection(cursor)

    def acquire(self):
        return AsyncContext(self.connection)


@pytest.mark.parametrize(
    'rowcount, expected_stat',
    [(1, 'news inserted'), (2, 'news updated'), (0, 'news updated')],
)
def test_insert_news_upsert_logging(monkeypatch, rowcount, expected_stat):
    import asyncio
    cursor = FakeCursor(rowcount)
    pool = FakePool(cursor)
    stats_calls = []
    log_calls = []

    async def fake_init_pool():
        return pool

    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    monkeypatch.setattr(
        db.stats, 'stats_sum',
        lambda name, value: stats_calls.append((name, value)))
    monkeypatch.setattr(
        db.LOGGER, 'info',
        lambda msg, *args: log_calls.append((msg, args)))

    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(db.insert_news(
        news_id=123,
        title='News Title',
        stats_counter='3700',
        company_code='oktell',
        score_counter=24,
        bookmarks_counter=2,
        comments_counter=24,
    ))

    assert result is True
    assert (expected_stat, 1) in stats_calls
    
    if rowcount != 1:
        assert len(log_calls) == 1
        assert log_calls[0][0] == 'updated existing news %s for company %s'
        assert log_calls[0][1] == (123, 'oktell')
    else:
        assert len(log_calls) == 0

@pytest.mark.parametrize(
    'rowcount, expected_stat',
    [(1, 'articles inserted'), (2, 'articles updated'), (0, 'articles updated')],
)
def test_insert_article_upsert_updates_crawler_fields_only(
        monkeypatch, rowcount, expected_stat):
    cursor = FakeCursor(rowcount)
    pool = FakePool(cursor)
    stats_calls = []

    async def fake_init_pool():
        return pool

    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    monkeypatch.setattr(
        db.stats, 'stats_sum',
        lambda name, value: stats_calls.append((name, value)))

    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(db.insert_article(
        article_id=123,
        title='Correct detail title',
        stats_counter='3700',
        label_id='reportage',
        company_code='oktell',
        score_counter=24,
        bookmarks_counter=2,
        comments_counter=24,
    ))

    assert result is True
    assert 'ON DUPLICATE KEY UPDATE' in cursor.query
    for column in (
            'title', 'stats_counter', 'label', 'score_counter',
            'bookmarks_counter', 'comments_counter'):
        assert '{} = new.{}'.format(column, column) in cursor.query
    for column in (
            'action_dev', 'action_post', 'action_comment',
            'action_industry', 'action_company'):
        assert column not in cursor.query
    assert cursor.params == (
        123, 'Correct detail title', '3700', 'reportage', 'oktell',
        24, 2, 24)
    assert stats_calls == [(expected_stat, 1)]


def test_link_article_hub_uses_warning_free_idempotent_insert(monkeypatch):
    cursor = FakeCursor(1)
    pool = FakePool(cursor)
    async def fake_init_pool():
        return pool
    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    loop = asyncio.get_event_loop()
    loop.run_until_complete(db.link_article_hub(946376, 'fix_price'))
    assert 'INSERT IGNORE' not in cursor.query
    assert 'ON DUPLICATE KEY UPDATE article_id = article_id' in cursor.query
    assert cursor.params == (946376, 'fix_price')
@pytest.mark.parametrize(
    'function, args, no_op_column',
    [
        (db.link_post_hub, (946376, 'fix_price'), 'post_id = post_id'),
        (db.link_news_hub, (946376, 'fix_price'), 'news_id = news_id'),
        (db.link_company_category, ('neoflex', 'fintech'),
         'company_code = company_code'),
    ],
)
def test_link_tables_use_warning_free_idempotent_insert(
        monkeypatch, function, args, no_op_column):
    cursor = FakeCursor(1)
    pool = FakePool(cursor)
    async def fake_init_pool():
        return pool
    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    loop = asyncio.get_event_loop()
    loop.run_until_complete(function(*args))
    assert 'INSERT IGNORE' not in cursor.query
    assert 'ON DUPLICATE KEY UPDATE' in cursor.query
    assert no_op_column in cursor.query
    assert cursor.params == args


@pytest.mark.parametrize(
    'function, table, code',
    [
        (db.insert_article_code_only, 'articles', 101),
        (db.insert_post_code_only, 'posts', 102),
        (db.insert_news_code_only, 'news', 103),
    ],
)
def test_code_only_insert_uses_idempotent_insert(monkeypatch, function, table, code):
    cursor = FakeCursor(1)
    pool = FakePool(cursor)

    async def fake_init_pool():
        return pool

    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    monkeypatch.setattr(db.stats, 'stats_sum', lambda name, value: None)

    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(function(code))

    assert result is True
    assert 'INSERT INTO {}'.format(table) in cursor.query
    assert '(id, title)' in cursor.query
    assert 'ON DUPLICATE KEY UPDATE id = id' in cursor.query
    assert cursor.params == (code, '')


@pytest.mark.parametrize(
    'function',
    [db.insert_article_code_only, db.insert_post_code_only,
     db.insert_news_code_only],
)
def test_code_only_insert_returns_false_for_existing_row(monkeypatch, function):
    cursor = FakeCursor(0)
    pool = FakePool(cursor)

    async def fake_init_pool():
        return pool

    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    monkeypatch.setattr(db.stats, 'stats_sum', lambda name, value: None)

    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(function(101))

    assert result is False
    assert cursor.params == (101, '')


@pytest.mark.parametrize(
    'flag, parser_name',
    [('post_id', 'parse_and_save_post')],
)
def test_post_detail_parser_is_routed(monkeypatch, flag, parser_name):
    # Kept as a small source-level contract test in the DB test module only
    # because the full HTTP response fixture is expensive to construct here.
    import inspect
    import habrcrawler.post_fetch as post_fetch

    source = inspect.getsource(post_fetch.post_2xx)
    assert "ridealong.get('post_id') is not None" in source
    assert parser_name in source
    assert flag in source


def test_get_or_create_hub_normalizes_and_repairs_existing_title(monkeypatch):
    cursor = HubCursor(('webdev', 'Веб-разработка *'))
    pool = FakePool(cursor)

    async def fake_init_pool():
        return pool

    monkeypatch.setattr(db, 'init_pool', fake_init_pool)
    db._hub_cache.clear()
    db._hub_title_cache.clear()

    result = asyncio.get_event_loop().run_until_complete(
        db.get_or_create_hub('webdev', 'Веб-разработка *'))

    assert result == 'webdev'
    assert cursor.executed[0] == (
        'SELECT code, title FROM hubs WHERE code = %s', ('webdev',))
    assert cursor.executed[1] == (
        'UPDATE hubs SET title = %s WHERE code = %s',
        ('Веб-разработка', 'webdev'))
