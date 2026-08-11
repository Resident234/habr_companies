'''
Parser for Habr company post pages:

    https://habr.com/ru/companies/{company}/posts/{post_id}/

A post page is not a full article page: there is no <h1 tm-title>, no
.tm-publication-hubs container and no votes meter. Title, score and
hubs are taken from the embedded preloaded-state JSON entry whose
publicationType is "post"; views/bookmarks/comments counters use the
same icon markup as articles. The posts table has no label column,
so labels are ignored.
'''
import html as html_module
import json
import logging
import re

from bs4 import BeautifulSoup

from . import db
from . import stats
from . import habr_parse

LOGGER = logging.getLogger(__name__)

# e.g. https://habr.com/ru/companies/ruvds/posts/1064400/
POST_URL_RE = re.compile(
    r'/ru/companies/(?P<company>[^/]+)/posts/(?P<post_id>\d+)')

# markers of the preloaded-state json entry of a post publication:
# "publicationType":"post", ... "titleHtml":"..." (other fields are in
# between, so just require both strings to be present)
POST_MARKER_RES = tuple(re.compile(pattern) for pattern in (
    r'"publicationType"\s*:\s*"post"',
    r'"titleHtml"\s*:\s*"',
))
TITLE_HTML_RE = re.compile(r'"titleHtml"\s*:\s*"((?:[^"\\]|\\.)*)"')
# "statistics" block of the post json entry -- the key order is from
# the preloaded-state serializer, so match the value right after "score"
SCORE_STATS_RE = re.compile(r'"score"\s*:\s*(-?\d+)')

HUB_RE = re.compile(
    r'"alias"\s*:\s*"((?:[^"\\]|\\.)*)"[^}]*?"title"\s*:\s*"((?:[^"\\]|\\.)*)"')

# how far past the post entry the tail json may span (hubs + stats)
POST_JSON_SPAN = 200000


def _unescape(text):
    '''
    Unescape a json string value (\\uXXXX, \\/, etc.) and html entities.
    '''
    try:
        text = json.loads('"' + text + '"')
    except ValueError:
        pass
    return html_module.unescape(text)


def _post_entry_marker(page_html, post_id):
    '''
    Locate the preloaded-state json entry of this exact post id.
    Returns a re.Match (position) or None.
    '''
    return re.search(
        r'"publicationType"\s*:\s*"post"\s*,\s*"id"\s*:\s*"' +
        str(post_id) + r'"', page_html)



def parse_post_html(page_html, url):
    '''
    Parse a company post page, return a dict of extracted fields or
    None if the page is not a valid post page.
    '''
    url_m = POST_URL_RE.search(url)
    if url_m is None:
        return None

    if not all(marker.search(page_html) for marker in POST_MARKER_RES):
        # not a post page (404, redirect target, error page, etc.)
        return None

    post_id = int(url_m.group('post_id'))
    entry_m = _post_entry_marker(page_html, post_id)
    tail_start = entry_m.start() if entry_m is not None else None
    tail = (page_html[tail_start:tail_start + POST_JSON_SPAN]
            if tail_start is not None else '')

    # title: "titleHtml":"..." inside the post json entry
    title = ''
    if tail and entry_m is not None:
        # skip hub-level "titleHtml" entries -- the post title is the one
        # that directly contains the post id in a preceding "leadData"
        # block, so take the LAST titleHtml of the post json entry
        for title_m in TITLE_HTML_RE.finditer(tail):
            title = _unescape(title_m.group(1)).strip()

    # views/bookmarks/comments: the top icons bar uses the same markup
    # as article pages
    soup = BeautifulSoup(page_html, 'lxml')

    stats_counter = None
    views_el = soup.find('span', class_='tm-icon-counter__value')
    if views_el is not None:
        stats_counter = views_el.get('title') or views_el.get_text(strip=True)

    bookmarks_counter = None
    bm_btn = soup.find('button', class_='bookmarks-button')
    if bm_btn is not None:
        counter_el = bm_btn.find('span', class_='counter')
        if counter_el is not None:
            bookmarks_counter = habr_parse._to_int(
                counter_el.get_text(strip=True))

    comments_counter = None
    comments_el = soup.find('a', class_='article-comments-counter-link')
    if comments_el is not None:
        value_el = comments_el.find('span', class_='value')
        if value_el is not None:
            comments_counter = habr_parse._to_int(
                value_el.get_text(strip=True))

    # score: no votes meter on post pages, take it from the json stats
    # ("statistics":{...,"score":26,"votesCount":15,...})
    score_counter = None
    if tail:
        score_m = SCORE_STATS_RE.search(tail)
        if score_m is not None:
            score_counter = int(score_m.group(1))

    hubs = _parse_hubs_json(tail) if tail else []

    return {
        'id': post_id,
        'title': title,
        'stats_counter': stats_counter,
        'hubs': hubs,
        'score_counter': score_counter,
        'bookmarks_counter': bookmarks_counter,
        'comments_counter': comments_counter,
    }


async def parse_and_save_post(page_html, url, company_code):
    '''
    Parse the post page and write everything to the database.
    Returns True if a post row was saved.
    '''
    try:
        data = parse_post_html(page_html, url)
    except Exception as e:
        LOGGER.warning('failed to parse post %s: %s', url, e)
        stats.stats_sum('habr post parse errors', 1)
        return False

    if data is None:
        stats.stats_sum('habr non-post pages', 1)
        return False

    if not data['title']:
        LOGGER.warning('no title on post page %s', url)
        return False

    inserted = await db.insert_post(
        post_id=data['id'],
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
            await db.link_post_hub(data['id'], hub_code)
        LOGGER.info('saved post %s (%s) for company %s',
                    data['id'], data['title'][:50], company_code)

    return inserted


def _parse_hubs_json(post_json):
    '''
    Extract hub entries from the preloaded-state json of one post
    publication (entries look like
    {"id":"306774","alias":"ruvds","type":"corporative","title":"..."}).
    '''
    hubs = []
    for hub_m in HUB_RE.finditer(post_json):
        code = _unescape(hub_m.group(1)).strip()
        title = _unescape(hub_m.group(2)).strip()
        if code:
            hubs.append({'code': code, 'title': title})
    return hubs
