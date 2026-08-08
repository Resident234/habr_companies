'''
Unit tests for the Habr news parser.

News pages share the article page layout, so the parser reuses
habr_parse.parse_article_html; these tests cover news url id extraction
and news page recognition. All tests are offline (no network, no DB).
'''
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.habr_news_parse import NEWS_URL_RE
from habrcrawler.habr_parse import parse_article_html

NEWS_URL = 'https://habr.com/ru/companies/lanit/news/984896/'

NEWS_HTML = '''
<html><body>
<div class="tm-publication-hubs">
  <a href="/ru/companies/lanit/news/" class="tm-publication-hub__link"><span>Блог компании ЛАНИТ</span></a>
  <a href="/ru/hubs/it_companies/" class="tm-publication-hub__link"><!--[--><span>IT-компании</span><!----><!--]--></a>
</div>
<h1 class="tm-title tm-title_h1" lang="ru"><span>ЛАНИТ запустила новую цифровую платформу</span></h1>
<span class="tm-icon-counter__value" title="431">431</span>
<span class="tm-votes-meter__value tm-votes-meter__value_rating" title="Рейтинг">+36</span>
<button class="bookmarks-button tm-data-icons__item" title="Добавить в закладки" type="button"><span class="counter" title="Количество пользователей, добавивших публикацию в закладки">4</span></button>
<div class="article-comments-counter-link-wrapper tm-data-icons__item" title="Читать комментарии"><a href="/ru/companies/lanit/news/984896/comments/" class="article-comments-counter-link"><svg class="tm-svg-img icon" height="24" width="24"><title>Комментарии</title></svg><span class="value">8</span></a></div>
</body></html>
'''


def test_news_url_re():
    m = NEWS_URL_RE.search(NEWS_URL)
    assert m is not None
    assert m.group('company') == 'lanit'
    assert m.group('news_id') == '984896'

    # article urls must not match the news pattern
    assert NEWS_URL_RE.search(
        'https://habr.com/ru/companies/ru_mts/articles/1066076/') is None


def test_parse_news_html_fields():
    data = parse_article_html(NEWS_HTML, NEWS_URL)

    assert data is not None

    # parse_article_html only knows /articles/ urls -- the news wrapper
    # fills the id from NEWS_URL_RE instead
    assert data['id'] is None
    assert NEWS_URL_RE.search(NEWS_URL).group('news_id') == '984896'

    assert data['title'] == 'ЛАНИТ запустила новую цифровую платформу'
    assert data['stats_counter'] == '431'

    assert len(data['hubs']) == 2
    assert data['hubs'][0] == {'code': 'lanit',
                               'title': 'Блог компании ЛАНИТ'}
    assert data['hubs'][1] == {'code': 'it_companies',
                               'title': 'IT-компании'}

    assert data['score_counter'] == 36
    assert data['bookmarks_counter'] == 4
    assert data['comments_counter'] == 8


def test_parse_non_news_returns_none():
    assert parse_article_html(
        '<html><body><p>404</p></body></html>', NEWS_URL) is None
