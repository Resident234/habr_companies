'''
Pure-Python replacement for the `reppy` robots.txt parser.

`reppy` ships a C++ extension (`reppy.robots`) which cannot be built on
Windows without MSVC Build Tools. This module provides a small adapter
with the same interface (`Robots.parse`, `.allowed()`, `.sitemaps`)
built on top of the standard library `urllib.robotparser`.
'''

import urllib.robotparser


class Robots:
    def __init__(self, parser, sitemaps):
        self._parser = parser
        self.sitemaps = sitemaps

    @classmethod
    def parse(cls, url, body):
        parser = urllib.robotparser.RobotFileParser()
        parser.set_url(url)
        # robotparser expects a list of lines without trailing newlines
        lines = [line.rstrip('\r') for line in body.split('\n')]
        parser.parse(lines)
        sitemaps = cls._extract_sitemaps(body)
        return cls(parser, sitemaps)

    @staticmethod
    def _extract_sitemaps(body):
        sitemaps = []
        for line in body.splitlines():
            line = line.strip()
            if line.lower().startswith('sitemap:'):
                sitemap = line.split(':', 1)[1].strip()
                if sitemap:
                    sitemaps.append(sitemap)
        return sitemaps

    def allowed(self, path, user_agent):
        # reppy returns True/False; robotparser.can_fetch does the same
        return self._parser.can_fetch(user_agent, path)
