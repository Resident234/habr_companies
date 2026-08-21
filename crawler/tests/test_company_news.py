import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.company_news import parse_news_list_html

NEWS_LIST_HTML = """
<html><body>
<article id="12345" class="tm-articles-list__item">
    <h2 class="tm-title tm-title_h2"><span>Test News Title</span></h2>
    <div class="article-formatted-body">News Content</div>
    <span class="tm-icon-counter__value" title="123">123</span>
    <div class="tm-publication-hubs">
        <a href="/ru/companies/testco/" class="tm-publication-hub__link">Блог компании TestCo</a>
    </div>
    <span class="tm-votes-meter__value_rating">+10</span>
    <button class="bookmarks-button"><span class="counter">5</span></button>
    <a class="article-comments-counter-link"><span class="value">2</span></a>
</article>
</body></html>
"""

def test_parse_news_list_html():
    news = parse_news_list_html(NEWS_LIST_HTML)
    assert len(news) == 1
    assert news[0]['id'] == 12345
    assert news[0]['title'] == 'Test News Title'
    assert news[0]['stats_counter'] == '123'
    assert news[0]['score_counter'] == 10
    assert news[0]['bookmarks_counter'] == 5
    assert news[0]['comments_counter'] == 2
    assert len(news[0]['hubs']) == 1
    assert news[0]['hubs'][0]['code'] == 'testco'
