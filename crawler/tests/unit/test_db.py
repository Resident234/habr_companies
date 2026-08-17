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