'''
Unit tests for the Habr company banner links parser.
'''
import sys
import os
import json

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from habrcrawler.company_banners import parse_banners_html


HTML_SWIPER = '''
<div class="swiper-wrapper">
    <a class="tm-widget-banner-content__image-wrapper"
       href="https://t.me/+nmxTyyOhV-ozYjUy">
        <img alt="" class="tm-widget-banner-content__image"
             src="//habrastorage.org/getpro/habr/widget/6ba/2ac/0d7/6ba2ac0d76e059ad282b6cb1f9af45d7.jpg">
    </a>
    <a class="tm-widget-banner-content__image-wrapper"
       href="https://t.me/anotherChannel">
        <img alt="" class="tm-widget-banner-content__image"
             src="//habrastorage.org/getpro/habr/widget/aaa/bbb/ccc/aaabbbccc.jpg">
    </a>
</div>
'''


HTML_SINGLE_BANNER = '''
<div class="tm-widget-banner-content">
    <a class="tm-widget-banner-content__image-wrapper"
       href="https://t.me/singleChannel">
        <img alt="" class="tm-widget-banner-content__image"
             src="//habrastorage.org/getpro/habr/widget/single.jpg">
    </a>
</div>
'''


HTML_NO_BANNER = '''
<div class="some-other-content">
    <p>No banners here</p>
</div>
'''


HTML_EMPTY_SWIPER = '''
<div class="swiper-wrapper">
</div>
'''


HTML_MISSING_HREF = '''
<div class="swiper-wrapper">
    <a class="tm-widget-banner-content__image-wrapper">
        <img alt="" class="tm-widget-banner-content__image"
             src="//habrastorage.org/getpro/habr/widget/missing.jpg">
    </a>
    <a class="tm-widget-banner-content__image-wrapper"
       href="https://t.me/validChannel">
        <img alt="" class="tm-widget-banner-content__image"
             src="//habrastorage.org/getpro/habr/widget/valid.jpg">
    </a>
</div>
'''


def test_parse_swiper_multiple_banners():
    links = parse_banners_html(HTML_SWIPER)
    assert len(links) == 2
    assert links[0] == {'href': 'https://t.me/+nmxTyyOhV-ozYjUy'}
    assert links[1] == {'href': 'https://t.me/anotherChannel'}


def test_parse_single_banner_fallback():
    links = parse_banners_html(HTML_SINGLE_BANNER)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/singleChannel'}


def test_parse_no_banner():
    links = parse_banners_html(HTML_NO_BANNER)
    assert links == []


def test_parse_empty_swiper():
    links = parse_banners_html(HTML_EMPTY_SWIPER)
    assert links == []


def test_parse_missing_href():
    links = parse_banners_html(HTML_MISSING_HREF)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/validChannel'}


def test_parse_deduplicates_hrefs():
    html = '''
    <div class="swiper-wrapper">
        <a class="tm-widget-banner-content__image-wrapper"
           href="https://t.me/dup">
            <img alt="" class="tm-widget-banner-content__image"
                 src="//habrastorage.org/getpro/habr/widget/1.jpg">
        </a>
        <a class="tm-widget-banner-content__image-wrapper"
           href="https://t.me/dup">
            <img alt="" class="tm-widget-banner-content__image"
                 src="//habrastorage.org/getpro/habr/widget/2.jpg">
        </a>
    </div>
    '''
    links = parse_banners_html(html)
    assert len(links) == 1
    assert links[0] == {'href': 'https://t.me/dup'}


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
                    [{'href': 'https://t.me/new'}]
                )
            )
            assert result is True
            assert company_banners._last_merged == [
                {'href': 'https://example.com', 'title': 'Example'},
                {'href': 'https://t.me/old', 'title': 'Old'},
                {'href': 'https://t.me/new'},
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
