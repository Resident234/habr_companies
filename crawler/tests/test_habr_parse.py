'''
Unit test for the Habr article parser, based on the HTML snippets from
the task description.
'''
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.habr_parse import parse_article_html, _to_int

URL = 'https://habr.com/ru/companies/ru_mts/articles/1066076/'

HTML = '''
<html><body>
<div class="tm-publication-hubs">
  <a href="/ru/hubs/artificial_intelligence/" class="tm-publication-hub__link tm-publication-hub__link_subscribed"><!--[--><span>Искусственный интеллект</span><!----><!--]--></a>
  <a href="/ru/hubs/machine_learning/" class="tm-publication-hub__link"><span>Машинное обучение</span></a>
</div>
<h1 class="tm-title tm-title_h1" lang="ru" data-v-2f5dd140=""><span>«Вам может это понравиться»: на Урбан ML разобрались, почему рекомендательные системы перестали предлагать похожее</span></h1>
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
    <h1 class="tm-title tm-title_h1" lang="ru">
      <span>{YEASTAR_TITLE}</span>
    </h1>
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
