import inspect

import habrcrawler as crawler_module
import habrcrawler.config as config
import habrcrawler.post_fetch as post_fetch


def _mode_config():
    return {
        'Habr': {flag: False for flag in config.HABR_MODE_FLAGS},
    }


def test_habr_mode_enabled_without_articles_mode():
    values = _mode_config()
    values['Habr']['PostsMode'] = True
    config.set_config(values)

    assert values['Habr']['ArticlesMode'] is False
    assert config.habr_mode_enabled() is True


def test_habr_mode_disabled_when_all_independent_modes_are_false():
    config.set_config(_mode_config())

    assert config.habr_mode_enabled() is False


def test_crawler_seed_branches_do_not_depend_on_articles_mode():
    source = inspect.getsource(crawler_module.Crawler.__init__)

    assert 'if self.habr_categories_mode:' in source
    assert 'elif self.habr_posts_mode:' in source
    assert 'elif self.habr_post_pages_mode:' in source
    assert 'self.habr_articles_mode and self.habr_posts_mode' not in source
    assert 'self.habr_articles_mode and self.habr_post_pages_mode' not in source


def test_habr_response_dispatch_does_not_read_articles_mode_directly():
    source = inspect.getsource(post_fetch.post_2xx)

    assert 'if config.habr_mode_enabled():' in source
    assert "config.read('Habr', 'ArticlesMode')" not in source
