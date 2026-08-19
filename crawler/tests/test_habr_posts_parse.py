'''
Unit test for the Habr company posts list parser, based on the HTML
snippet from the task description.
'''
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.company_posts import parse_posts_list_html, posts_page_url, \
    POSTS_URL_TEMPLATE

HTML = '''<html><body>
<article id="1026612" class="tm-articles-list__item tm-articles-list__item_no-padding" data-navigatable="" tabindex="0"><div class="tm-post-snippet"><div class="tm-post-snippet__meta"><span class="tm-user-info"><span class="tm-user-info__user tm-user-info__user_appearance-post"><a href="/ru/users/go_shan/" class="tm-user-info__username">go_shan</a><div class="meta"><a href="/ru/companies/avito/posts/1026612/" class="tm-article-datetime-published tm-article-datetime-published_link"><time datetime="2026-04-22T14:10:57.000Z" title="2026-04-22, 17:10">22  апр   в 17:10</time></a><span class="tm-icon-counter"><span class="tm-icon-counter__value" title="3256">3.3K</span></span></div></span></span></div>
<div class="tm-publication-hubs__container tm-post-snippet__hubs"><div class="tm-publication-hubs">
<span class="tm-publication-hub__link-container"><a href="/ru/companies/avito/posts/" class="tm-publication-hub__link"><span>Блог компании AvitoTech</span></a></span>
<span class="tm-publication-hub__link-container"><a href="/ru/hubs/it_testing/posts/" class="tm-publication-hub__link"><span>Тестирование IT-систем</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a></span>
<span class="tm-publication-hub__link-container"><a href="/ru/hubs/web_testing/posts/" class="tm-publication-hub__link"><span>Тестирование веб-сервисов</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a></span>
<span class="tm-publication-hub__link-container"><a href="/ru/hubs/mobile_testing/posts/" class="tm-publication-hub__link"><span>Тестирование мобильных приложений</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a></span>
</div></div>
<div class="tm-post-snippet__content"><div><div><div class="article-formatted-body article-formatted-body_version-2"><div>
<p><strong>Ручное vs автоматизированное тестирование: где заканчивается автоматизация и начинается здравый смысл</strong></p>
<p>Спор между сторонниками ручного тестирования и автоматизации идёт давно.</p>
</div></div></div></div></div>
<div class="tm-data-icons tm-data-icons_space-big tm-post-snippet__icons">
<div class="article-rating tm-data-icons__item"><div class="tm-votes-meter votes-switcher"><span class="tm-votes-meter__value tm-votes-meter__value_positive tm-votes-meter__value_rating" title="Всего голосов 26: ↑26 и ↓0">+26</span></div></div>
<button class="bookmarks-button tm-data-icons__item" title="Добавить в закладки" type="button"><span class="counter" title="Количество пользователей, добавивших публикацию в закладки">4</span></button>
<div class="article-comments-counter-link-wrapper tm-data-icons__item" title="Читать комментарии"><a href="/ru/companies/avito/posts/1026612/#publication-comments" class="article-comments-counter-link"><span class="value">0</span></a></div>
</div>
</div></article>
</body></html>
'''


def test_parse_posts_list_html():
    posts = parse_posts_list_html(HTML)

    assert len(posts) == 1
    post = posts[0]

    assert post['id'] == 1026612
    assert post['title'] == ('Ручное vs автоматизированное тестирование: '
                             'где заканчивается автоматизация и начинается '
                             'здравый смысл')
    assert post['stats_counter'] == '3256'
    assert post['score_counter'] == 26
    assert post['bookmarks_counter'] == 4
    assert post['comments_counter'] == 0

    codes = [h['code'] for h in post['hubs']]
    assert codes == ['avito', 'it_testing', 'web_testing', 'mobile_testing']
    assert post['hubs'][1]['title'] == 'Тестирование IT-систем'
    assert [hub['title'] for hub in post['hubs']] == [
        'Блог компании AvitoTech',
        'Тестирование IT-систем',
        'Тестирование веб-сервисов',
        'Тестирование мобильных приложений',
    ]


def test_parse_empty_page_returns_empty_list():
    assert parse_posts_list_html('<html><body><p>ничего</p></body></html>') == []


def test_article_without_body_is_skipped():
    html = ('<article id="123" class="tm-articles-list__item">'
            '<div>рекламный блок</div></article>')
    assert parse_posts_list_html(html) == []


def test_non_numeric_article_id_is_skipped():
    html = ('<article id="news" class="tm-articles-list__item">'
            '<div class="article-formatted-body"><p>x</p></div></article>')
    assert parse_posts_list_html(html) == []


def test_posts_page_url():
    url = posts_page_url(POSTS_URL_TEMPLATE, 'avito', 1)
    assert url == 'https://habr.com/ru/companies/avito/posts/'
    url = posts_page_url(POSTS_URL_TEMPLATE, 'avito', 2)
    assert url == 'https://habr.com/ru/companies/avito/posts/page2/'
