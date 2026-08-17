import asyncio
import time

import aiohttp
import pytest

import habrcrawler as crawler_module
from habrcrawler import fetcher
from habrcrawler import stats
from habrcrawler.urls import URL


class BrokenSession:
    async def get(self, *args, **kwargs):
        raise aiohttp.ServerDisconnectedError()


def run(coro):
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(coro)
    finally:
        loop.close()
        asyncio.set_event_loop(None)


def test_fetch_records_detailed_client_error_counter():
    error_name = 'fetch error ServerDisconnectedError'
    general_name = 'fetch ClientError'
    detailed_before = stats.stat_value(error_name) or 0
    general_before = stats.stat_value(general_name) or 0

    response = run(fetcher.fetch(URL('https://example.com/'), BrokenSession()))

    assert response.response is None
    assert response.last_exception.startswith('ClientError: ServerDisconnectedError:')
    assert stats.stat_value(error_name) == detailed_before + 1
    assert stats.stat_value(general_name) == general_before + 1


def test_retry_requeue_records_counter(monkeypatch):
    class Scheduler:
        def __init__(self):
            self.ridealong = None
            self.requeued = None

        def set_ridealong(self, surt, ridealong):
            self.ridealong = (surt, ridealong)

        def update_priority(self, priority, rand):
            return priority, rand

        def requeue_work(self, work):
            self.requeued = work

        def del_ridealong(self, surt):
            raise AssertionError('retry should not be exhausted')

    crawler = crawler_module.Crawler.__new__(crawler_module.Crawler)
    crawler.scheduler = Scheduler()
    monkeypatch.setattr(crawler_module.seeds, 'fail', lambda *args: None)
    name = 'retries requeued'
    before = stats.stat_value(name) or 0

    crawler._retry_if_able(
        (1, 0.0, 'http://example.com/'),
        {'retries_left': 2},
        {},
    )

    assert stats.stat_value(name) == before + 1
    assert crawler.scheduler.requeued is not None


def test_minute_records_rates_and_current_work_state(monkeypatch):
    scheduler = type(
        'Scheduler', (), {'qsize': lambda self: 7, 'ridealong_size': lambda self: 9}
    )()
    crawler = crawler_module.Crawler.__new__(crawler_module.Crawler)
    crawler.next_minute = 0
    crawler._monitor_time = time.time() - 60
    crawler._monitor_totals = {}
    crawler.scheduler = scheduler
    crawler.resolver = type('Resolver', (), {'size': lambda self: 3})()
    crawler.workers = [object(), object(), object()]
    crawler.active_retries = 1
    crawler.memory_crawler = None

    monkeypatch.setattr(crawler_module.stats, 'report', lambda: None)
    monkeypatch.setattr(crawler_module.stats, 'coroutine_report', lambda: None)
    monkeypatch.setattr(crawler_module.memory, 'print_summary', lambda *args: None)

    crawler.minute()
    increments = {
        'articles inserted': 2,
        'articles updated': 1,
        'news inserted': 3,
        'posts inserted': 4,
        'fetch URLs': 5,
        'fetch ClientError': 1,
    }
    for name, value in increments.items():
        stats.stats_sum(name, value)
    crawler._monitor_time = time.time() - 60
    crawler.next_minute = 0
    crawler.minute()

    assert stats.stat_value('articles per minute') == pytest.approx(3, rel=0.05)
    assert stats.stat_value('news per minute') == pytest.approx(3, rel=0.05)
    assert stats.stat_value('posts per minute') == pytest.approx(4, rel=0.05)
    assert stats.stat_value('pages per minute') == pytest.approx(5, rel=0.05)
    assert stats.stat_value('client errors per minute') == pytest.approx(1, rel=0.05)
    assert stats.stat_value('queue size') == 7
    assert stats.stat_value('ridealong size') == 9
    assert stats.stat_value('active workers') == 3
    assert stats.stat_value('active retries') == 1
