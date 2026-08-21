'''
Unit test for the Habr company links parser.
'''
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.company_links import parse_links_html


JSON_RESPONSE = '''
{
  "widgetRefs": [
    {
      "type": "links",
      "data": {
        "links": [
          {
            "title": "RUVDS main",
            "linkUrl": "https://ruvds.com"
          },
          {
            "title": "Telegram",
            "linkUrl": "https://t.me/ruvds"
          }
        ]
      }
    },
    {
      "type": "other",
      "data": {
        "links": [
          {
            "title": "Should not be found",
            "linkUrl": "https://example.com"
          }
        ]
      }
    }
  ]
}
'''


def test_parse_links_html():
    links = parse_links_html(JSON_RESPONSE)

    assert len(links) == 2
    assert links[0]['href'] == 'https://ruvds.com'
    assert links[0]['title'] == 'RUVDS main'
    assert links[0]['rel'] == ['nofollow', 'noreferrer']
    assert links[0]['target'] == '_blank'

    assert links[1]['href'] == 'https://t.me/ruvds'
    assert links[1]['title'] == 'Telegram'
    assert links[1]['rel'] == ['nofollow', 'noreferrer']
    assert links[1]['target'] == '_blank'


HTML_FALLBACK = '''
<!DOCTYPE html>
<html lang="ru">
<body>
<div class="tm-company-widgets">
  <div class="tm-block" type="links">
    <div class="tm-widget-links__list">
      <a class="tm-widget-links__link" href="https://example.com" rel="nofollow noreferrer" target="_blank" title="Fallback link">
        Fallback link
      </a>
    </div>
  </div>
</div>
</body></html>
'''

def test_parse_links_html_fallback():
    links = parse_links_html(HTML_FALLBACK)
    assert len(links) == 1
    assert links[0]['href'] == 'https://example.com'
    assert links[0]['title'] == 'Fallback link'


def test_parse_links_html_empty():
    assert parse_links_html('{}') == []
    assert parse_links_html('{"widgetRefs": []}') == []
    assert parse_links_html('invalid json') == []
    assert parse_links_html('') == []
    assert parse_links_html('   ') == []
