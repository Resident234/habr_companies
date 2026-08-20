'''
Unit test for the Habr article parser, based on the HTML snippets from
the task description.
'''
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler import db
from habrcrawler.habr_parse import parse_and_save, parse_article_html, _to_int

URL = 'https://habr.com/ru/companies/ru_mts/articles/1066076/'

HTML = '''
<html><body>
<div class="tm-publication-hubs">
  <a href="/ru/hubs/artificial_intelligence/" class="tm-publication-hub__link tm-publication-hub__link_subscribed"><!--[--><span>Искусственный интеллект</span><!----><!--]--></a>
  <a href="/ru/hubs/machine_learning/" class="tm-publication-hub__link"><span>Машинное обучение</span></a>
</div>
<div class="tm-article-presenter__header">
<h1 class="tm-title tm-title_h1" lang="ru" data-v-2f5dd140=""><span>«Вам может это понравиться»: на Урбан ML разобрались, почему рекомендательные системы перестали предлагать похожее</span></h1>
</div>
<span class="tm-icon-counter__value" title="1860">1.9K</span>
<div class="publication-label variant-reportage" data-v-d420b184="" data-v-db35b1ec=""><span data-v-db35b1ec="">Репортаж</span></div>
<span class="tm-votes-meter__value tm-votes-meter__value_rating" title="Рейтинг">+12</span>
<button class="bookmarks-button tm-data-icons__item" title="Добавить в закладки" type="button"><span class="tm-svg-icon__wrapper icon"><svg class="tm-svg-img tm-svg-icon" height="24" width="24"><title>Добавить в закладки</title><use xlink:href="/img/megazord-v28.svg?2.337.0#counter-favorite"></use></svg></span><span class="counter" title="Количество пользователей, добавивших публикацию в закладки">0</span></button>
<div class="article-comments-counter-link-wrapper tm-data-icons__item" title="Читать комментарии" data-v-766640b7=""><a href="/ru/companies/ru_mts/articles/1066076/comments/" class="article-comments-counter-link" data-v-766640b7=""><!--[--><svg class="tm-svg-img icon" height="24" width="24" data-v-766640b7=""><title>Комментарии</title><use xlink:href="/img/megazord-v28.svg?2.337.0#counter-comments"></use></svg><span class="value" data-v-766640b7="">0</span><!--]--></a><!----></div>
</body></html>
'''


def test_to_int():
    assert _to_int('0') == 0
    assert _to_int('+12') == 12
    assert _to_int('−3') == -3
    assert _to_int('1.9K') == 1900
    assert _to_int(None) is None
    assert _to_int('') is None


def test_parse_article_html():
    data = parse_article_html(HTML, URL)

    assert data is not None
    assert data['id'] == 1066076
    assert 'рекомендательные системы' in data['title']
    assert data['stats_counter'] == '1860'

    assert len(data['hubs']) == 2
    assert data['hubs'][0] == {'code': 'artificial_intelligence',
                               'title': 'Искусственный интеллект'}
    assert data['hubs'][1] == {'code': 'machine_learning',
                               'title': 'Машинное обучение'}

    assert data['label'] == {'code': 'reportage', 'title': 'Репортаж'}
    assert data['score_counter'] == 12
    assert data['bookmarks_counter'] == 0
    assert data['comments_counter'] == 0


def test_parse_non_article_returns_none():
    assert parse_article_html('<html><body><p>404</p></body></html>', URL) is None

YEASTAR_URL = 'https://habr.com/ru/companies/oktell/articles/123456/'
YEASTAR_TITLE = 'Плата компьютерной телефонии «Yeastar» для приема/передачи факсов'
YEASTAR_DETAIL_HTML = f'''
<html><body>
  <article class="tm-article-presenter__content">
    <div class="tm-article-presenter__header">
      <h1 class="tm-title tm-title_h1" lang="ru">
        <span>{YEASTAR_TITLE}</span>
      </h1>
    </div>
    <div class="article-formatted-body">
      <strong>Неправильный текст из preview списка статей</strong>
    </div>
  </article>
</body></html>
'''


def test_parse_article_title_from_detail_page():
    data = parse_article_html(YEASTAR_DETAIL_HTML, YEASTAR_URL)

    assert data is not None
    assert data['title'] == YEASTAR_TITLE


RUVDS_MULTI_HUB_URL = 'https://habr.com/ru/companies/ruvds/articles/1057964/'
RUVDS_MULTI_HUB_HTML = '''
<html><body>
<div class="tm-publication-hubs">
  <a href="/ru/companies/ruvds/articles/" class="tm-publication-hub__link"><span>Блог компании RUVDS.com</span></a>
  <a href="/ru/hubs/business_models/" class="tm-publication-hub__link"><span>Бизнес-модели</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a>
  <a href="/ru/hubs/webdev/" class="tm-publication-hub__link"><span>Веб-разработка</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a>
  <a href="/ru/hubs/engineering_systems/" class="tm-publication-hub__link"><span>Инженерные системы</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a>
  <a href="/ru/hubs/infosecurity/" class="tm-publication-hub__link"><span>Информационная безопасность</span><span class="tm-article-snippet__profiled-hub" title="Профильный хаб"> * </span></a>
</div>
<div class="tm-article-presenter__header"><h1 class="tm-title tm-title_h1"><span>Формула «идеального enterprise» для open-source</span></h1></div>
</body></html>
'''


def test_parse_all_article_hubs_and_strip_profiled_marker():
    data = parse_article_html(RUVDS_MULTI_HUB_HTML, RUVDS_MULTI_HUB_URL)

    assert data is not None
    assert data['hubs'] == [
        {'code': 'ruvds', 'title': 'Блог компании RUVDS.com'},
        {'code': 'business_models', 'title': 'Бизнес-модели'},
        {'code': 'webdev', 'title': 'Веб-разработка'},
        {'code': 'engineering_systems', 'title': 'Инженерные системы'},
        {'code': 'infosecurity', 'title': 'Информационная безопасность'},
    ]


def test_normalize_hub_title_only_removes_trailing_marker():
    from habrcrawler.habr_parse import _normalize_hub_title

    assert _normalize_hub_title('Agile *') == 'Agile'
    assert _normalize_hub_title('C++') == 'C++'
    assert _normalize_hub_title('Asterisk * in title') == 'Asterisk * in title'
    assert _normalize_hub_title(None) == ''


def test_parse_and_save_links_detail_and_list_hubs(monkeypatch):
    detail_html = '''
    <html><body>
      <div class="tm-publication-hubs">
        <a href="/ru/hubs/webdev/" class="tm-publication-hub__link">
          <span>Веб-разработка</span>
        </a>
      </div>
      <div class="tm-article-presenter__header"><h1 class="tm-title tm-title_h1"><span>Partial detail</span></h1></div>
    </body></html>
    '''
    hub_calls = []
    link_calls = []

    async def fake_insert_article(**kwargs):
        # Simulate an existing article/upsert path.
        return False

    async def fake_get_or_create_hub(code, title):
        hub_calls.append((code, title))
        return code

    async def fake_link_article_hub(article_id, hub_code):
        link_calls.append((article_id, hub_code))

    monkeypatch.setattr(db, 'insert_article', fake_insert_article)
    monkeypatch.setattr(db, 'get_or_create_hub', fake_get_or_create_hub)
    monkeypatch.setattr(db, 'link_article_hub', fake_link_article_hub)

    result = asyncio.get_event_loop().run_until_complete(parse_and_save(
        detail_html,
        RUVDS_MULTI_HUB_URL,
        'ruvds',
        article_hubs=[
            {'code': 'ruvds', 'title': 'Блог компании RUVDS.com'},
            {'code': 'webdev', 'title': 'Веб-разработка *'},
            {'code': 'business_models', 'title': 'Бизнес-модели *'},
        ],
    ))

    assert result is False
    assert [code for code, _ in hub_calls] == [
        'webdev', 'ruvds', 'business_models']
    assert hub_calls == [
        ('webdev', 'Веб-разработка'),
        ('ruvds', 'Блог компании RUVDS.com'),
        ('business_models', 'Бизнес-модели'),
    ]
    assert link_calls == [
        (1057964, 'webdev'),
        (1057964, 'ruvds'),
        (1057964, 'business_models'),
    ]
