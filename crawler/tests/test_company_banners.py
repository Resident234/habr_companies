'''
Unit tests for the Habr company banner links parser.
'''
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.company_banners import parse_banners_html


JSON_MULTIPLE_BANNERS = '''
{
  "widgetRefs": [
    {
      "type": "banner",
      "data": {
        "imageLinkUrl": "https://t.me/+nmxTyyOhV-ozYjUy"
      }
    },
    {
      "type": "banner",
      "data": {
        "imageLinkUrl": "https://t.me/anotherChannel"
      }
    }
  ]
}
'''

JSON_SINGLE_BANNER = '''
{
  "widgetRefs": [
    {
      "type": "banner",
      "data": {
        "imageLinkUrl": "https://t.me/singleChannel"
      }
    }
  ]
}
'''

JSON_NO_BANNER = '{"widgetRefs": []}'

JSON_MISSING_HREF = '''
{
  "widgetRefs": [
    {
      "type": "banner",
      "data": {}
    },
    {
      "type": "banner",
      "data": {
        "imageLinkUrl": "https://t.me/validChannel"
      }
    }
  ]
}
'''

HTML_FALLBACK = '''
<!DOCTYPE html>
<html><body>
<div class="swiper-wrapper">
    <a class="tm-widget-banner-content__image-wrapper"
       href="https://t.me/fallbackChannel">
        <img alt="" class="tm-widget-banner-content__image"
             src="//habrastorage.org/getpro/habr/widget/fallback.jpg">
    </a>
</div>
</body></html>
'''


def test_parse_multiple_banners():
    links = parse_banners_html(JSON_MULTIPLE_BANNERS)
    assert len(links) == 2
    assert links[0] == {'href': 'https://t.me/+nmxTyyOhV-ozYjUy'}
    assert links[1] == {'href': 'https://t.me/anotherChannel'}


def test_parse_single_banner():
    links = parse_banners_html(JSON_SINGLE_BANNER)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/singleChannel'}


def test_parse_no_banner():
    links = parse_banners_html(JSON_NO_BANNER)
    assert links == []
    assert parse_banners_html('{}') == []
    assert parse_banners_html('') == []


def test_parse_missing_href():
    links = parse_banners_html(JSON_MISSING_HREF)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/validChannel'}


def test_parse_deduplicates_hrefs():
    json_data = '''
    {
      "widgetRefs": [
        {"type": "banner", "data": {"imageLinkUrl": "https://t.me/dup"}},
        {"type": "banner", "data": {"imageLinkUrl": "https://t.me/dup"}}
      ]
    }
    '''
    links = parse_banners_html(json_data)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/dup'}


def test_parse_html_fallback():
    links = parse_banners_html(HTML_FALLBACK)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/fallbackChannel'}


def test_merge_banner_links_appends_new():
    import asyncio
    from unittest.mock import patch

    from habrcrawler import company_banners

    async def fake_get_company_links(code):
        return json.dumps([
            {'href': 'https://example.com', 'title': 'Example'},
            {'href': 'https://t.me/old', 'title': 'Old'},
        ])

    async def fake_update_company_links(code, links_json):
        company_banners._last_merged = json.loads(links_json)

    with patch.object(company_banners.db, 'get_company_links',
                      side_effect=fake_get_company_links):
        with patch.object(company_banners.db, 'update_company_links',
                          side_effect=fake_update_company_links):
            company_banners._last_merged = None
            result = asyncio.get_event_loop().run_until_complete(
                company_banners._merge_banner_links(
                    'testco',
                    [
                        {'href': 'https://t.me/new1'},
                        {'href': 'https://t.me/new2'}
                    ]
                )
            )
            assert result is True
            assert company_banners._last_merged == [
                {'href': 'https://example.com', 'title': 'Example'},
                {'href': 'https://t.me/old', 'title': 'Old'},
                {'href': 'https://t.me/new1'},
                {'href': 'https://t.me/new2'},
            ]


def test_merge_banner_links_skips_existing():
    import asyncio
    from unittest.mock import patch

    from habrcrawler import company_banners

    async def fake_get_company_links(code):
        return json.dumps([{'href': 'https://t.me/existing'}])

    update_called = []

    async def fake_update_company_links(code, links_json):
        update_called.append(json.loads(links_json))

    with patch.object(company_banners.db, 'get_company_links',
                      side_effect=fake_get_company_links):
        with patch.object(company_banners.db, 'update_company_links',
                          side_effect=fake_update_company_links):
            result = asyncio.get_event_loop().run_until_complete(
                company_banners._merge_banner_links(
                    'testco',
                    [{'href': 'https://t.me/existing'}]
                )
            )
            assert result is False
            # update_company_links should NOT be called when no new links
            assert update_called == []


def test_merge_banner_links_empty_existing():
    import asyncio
    from unittest.mock import patch

    from habrcrawler import company_banners

    async def fake_get_company_links(code):
        return None

    async def fake_update_company_links(code, links_json):
        company_banners._last_merged = json.loads(links_json)

    with patch.object(company_banners.db, 'get_company_links',
                      side_effect=fake_get_company_links):
        with patch.object(company_banners.db, 'update_company_links',
                          side_effect=fake_update_company_links):
            company_banners._last_merged = None
            result = asyncio.get_event_loop().run_until_complete(
                company_banners._merge_banner_links(
                    'testco',
                    [{'href': 'https://t.me/new'}]
                )
            )
            assert result is True
            assert company_banners._last_merged == [
                {'href': 'https://t.me/new'},
            ]
