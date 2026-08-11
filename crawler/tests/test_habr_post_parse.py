'''
Unit tests for the Habr company post page parser.

Post pages (https://habr.com/ru/companies/{company}/posts/{post_id}/)
are not full article pages: there is no h1.tm-title, no
.tm-publication-hubs container and no votes meter, so the parser takes
the title, hubs and score from the embedded preloaded-state json entry
(publicationType == "post") and the views/bookmarks/comments counters
from the same icon markup used by articles. All tests are offline
(no network, no DB).
'''
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.habr_post_parse import POST_URL_RE, parse_post_html

POST_URL = 'https://habr.com/ru/companies/ruvds/posts/1064400/'

POST_HTML = '''
<html><body>
<span class="tm-icon-counter__value" title="4619">4.6K</span>
<button class="bookmarks-button tm-data-icons__item" title="Добавить в закладки" type="button"><span class="counter" title="Количество пользователей, добавивших публикацию в закладки">1</span></button>
<div class="article-comments-counter-link-wrapper tm-data-icons__item" title="Читать комментарии"><a href="/ru/companies/ruvds/posts/1064400/comments/" class="article-comments-counter-link"><svg class="tm-svg-img icon" height="24" width="24"><title>Комментарии</title></svg><span class="value">0</span></a></div>
<script>window.__INITIAL_STATE__={"articlesList":{"articlesList":{"306774":{"alias":"ruvds","type":"corporative","title":"Блог компании RUVDS.com","titleHtml":"Блог компании RUVDS.com"},"1064400":{"publicationType":"post","id":"1064400","timePublished":"2026-07-30T10:00:21+00:00","titleHtml":"Как я перестал бояться и полюбил ассемблер","leadData":{},"hubs":[{"id":"306774","alias":"ruvds","type":"corporative","title":"Блог компании RUVDS.com"},{"id":"21484","alias":"electronics","type":"collective","title":"Производство и разработка электроники"}],"statistics":{"readingCount":4619,"commentsCount":0,"favoritesCount":1,"votesCount":15,"score":26}}}}};</script>
</body></html>
'''


def test_post_url_re():
    m = POST_URL_RE.search(POST_URL)
    assert m is not None
    assert m.group('company') == 'ruvds'
    assert m.group('post_id') == '1064400'

    # article and news urls must not match the post pattern
    assert POST_URL_RE.search(
        'https://habr.com/ru/companies/ru_mts/articles/1066076/') is None
    assert POST_URL_RE.search(
        'https://habr.com/ru/companies/lanit/news/984896/') is None


def test_parse_post_html_fields():
    data = parse_post_html(POST_HTML, POST_URL)

    assert data is not None

    assert data['id'] == 1064400
    # the post title is the titleHtml inside the post's own json entry,
    # not the hub-level titleHtml that appears earlier
    assert data['title'] == ('Как я перестал бояться '
                             'и полюбил ассемблер')
    assert data['stats_counter'] == '4619'
    assert data['score_counter'] == 26
    assert data['bookmarks_counter'] == 1
    assert data['comments_counter'] == 0

    assert data['hubs'] == [
        {'code': 'ruvds', 'title': 'Блог компании RUVDS.com'},
        {'code': 'electronics',
         'title': 'Производство и разработка электроники'},
    ]


def test_parse_non_post_returns_none():
    assert parse_post_html(
        '<html><body><p>404</p></body></html>', POST_URL) is None

    # an article url must not be parsed as a post
    assert parse_post_html(
        POST_HTML,
        'https://habr.com/ru/companies/ruvds/articles/1064400/') is None


def test_parse_real_post_fixture():
    '''
    data/html-post-page-test.html is a saved real post page
    (https://habr.com/ru/companies/ruvds/posts/1064400/). Skip silently
    if the fixture is not available.
    '''
    fixture = os.path.join(
        os.path.dirname(__file__), '..', 'data', 'html-post-page-test.html')
    if not os.path.isfile(fixture):
        return

    with open(fixture, encoding='utf-8') as f:
        html = f.read()

    data = parse_post_html(html, POST_URL)
    assert data is not None
    assert data['id'] == 1064400
    assert data['title'] == ('Как я перестал бояться '
                             'и полюбил ассемблер')
    assert data['score_counter'] == 26
    assert data['comments_counter'] == 0
    assert data['hubs'][0] == {'code': 'ruvds',
                               'title': 'Блог компании RUVDS.com'}
