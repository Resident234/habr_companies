'''
Version resolution tests for source-checkout execution.
'''

import habrcrawler
from setuptools_scm import get_version


def test_version_from_source_checkout():
    version = get_version(root='../..', relative_to=habrcrawler.__file__)

    assert isinstance(version, str)
    assert version
