'''
Parser for Habr company news pages.

News pages share the article page layout, so field extraction reuses
habr_parse helpers; only the url pattern differs:

    https://habr.com/ru/companies/{company}/news/{news_id}/

News are saved to the news table, hubs are linked via news_hubs.
'''
import logging
import re

from . import db
from . import stats
from . import habr_parse

LOGGER = logging.getLogger(__name__)

# e.g. https://habr.com/ru/companies/lanit/news/984896/
NEWS_URL_RE = re.compile(
    r'/ru/companies/(?P<company>[^/]+)/news/(?P<news_id>\d+)')


async def parse_and_save_news(html, url, company_code):
    '''
    Parse the news page and write everything to the database.
    Returns True if a news row was saved.
    '''
    try:
        data = habr_parse.parse_article_html(html, url)
    except Exception as e:
        LOGGER.warning('failed to parse news %s: %s', url, e)
        stats.stats_sum('habr news parse errors', 1)
        return False

    if data is None:
        stats.stats_sum('habr non-news pages', 1)
        return False

    # the article parser extracts the id from an /articles/ url pattern,
    # so news urls need their own id extraction
    data['id'] = None
    m = NEWS_URL_RE.search(url)
    if m:
        data['id'] = int(m.group('news_id'))
    if data['id'] is None:
        LOGGER.warning('no news id in url %s', url)
        return False

    inserted = await db.insert_news(
        news_id=data['id'],
        title=data['title'][:255],
        stats_counter=(data['stats_counter'] or '')[:255] or None,
        company_code=company_code,
        score_counter=data['score_counter'],
        bookmarks_counter=data['bookmarks_counter'],
        comments_counter=data['comments_counter'],
    )

    if inserted:
        for hub in data['hubs']:
            hub_code = await db.get_or_create_hub(hub['code'], hub['title'])
            await db.link_news_hub(data['id'], hub_code)
        LOGGER.info('saved news %s (%s) for company %s',
                    data['id'], data['title'][:50], company_code)

    return inserted
