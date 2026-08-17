import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.company_articles import (  # noqa: E402
    parse_and_save_articles,
    parse_articles_list_html,
)


HTML = '''
<article id="1066076" class="tm-articles-list__item">
  <div class="article-formatted-body"><strong>Неправильный текст preview</strong></div>
  <a href="/ru/companies/oktell/articles/1066076/">Открыть статью</a>
  <span class="tm-icon-counter__value" title="3700">3.7K</span>
</article>
'''


class FakeGenerator:
    def __init__(self):
        self.detail_urls = []
        self.list_pages = []

    def queue_article_page(self, company_code, article_id, article_url=None):
        self.detail_urls.append((company_code, article_id, article_url))

    def queue_articles_page(self, company_code, page):
        self.list_pages.append((company_code, page))


class FakeCrawler:
    def __init__(self):
        self.habr_generator = FakeGenerator()


def test_articles_list_extracts_detail_url():
    articles = parse_articles_list_html(HTML)

    assert len(articles) == 1
    assert articles[0]['id'] == 1066076
    assert articles[0]['url'] == (
        'https://habr.com/ru/companies/oktell/articles/1066076/'
    )
    assert articles[0]['title'] == 'Неправильный текст preview'


def test_articles_pages_mode_queues_detail_page_instead_of_saving_preview():
    crawler = FakeCrawler()
    loop = asyncio.get_event_loop()
    count = loop.run_until_complete(
        parse_and_save_articles(HTML, 'oktell', 1, crawler=crawler)
    )

    assert count == 1
    assert crawler.habr_generator.detail_urls == [(
        'oktell',
        1066076,
        'https://habr.com/ru/companies/oktell/articles/1066076/',
    )]
    assert crawler.habr_generator.list_pages == [('oktell', 2)]
