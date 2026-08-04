#!/usr/bin/env python

from os import path

from setuptools import setup


packages = [
    'crawler/setup.py',
]

requires = [
    'uvloop',
    'aiohttp',
    'yarl',
    'aiodns',
    'pyyaml',
    'cchardet',
    'surt',
    'reppy',
    'cachetools>=5',
    'tldextract>=3',
    'sortedcontainers',
    'sortedcollections',
    'psutil',
    'hdrhistogram',
    'beautifulsoup4',
    'lxml',
    'extensions',
    'warcio',
    'geoip2',
    'objgraph',
    'brotlipy',
    'setuptools_scm',
    'aiomysql',
    'PyMySQL',
]


test_requirements = [
    'bottle',
    'pytest>=3.0.0',
    'pytest-cov',
    'pytest-asyncio',
]

extras_require = {
    'test': test_requirements,  # setup no longer tests, so make them an extra
}

scripts = [
    'scripts/crawl.py',
]


this_directory = path.abspath(path.dirname(__file__))
with open(path.join(this_directory, 'README.md'), encoding='utf-8') as f:
    description = f.read()

setup(
    name='habr-companies-crawler',
    use_scm_version=True,
    description='Habr companies article parser built on the habrcrawler framework',
    long_description=description,
    long_description_content_type='text/markdown',
    author='Resident234',
    url='https://github.com/Resident234/habr_companies',
    packages=packages,
    python_requires=">=3.7",
    extras_require=extras_require,
    install_requires=requires,
    scripts=scripts,
    license='Apache 2.0',
    classifiers=[
        'Development Status :: 4 - Beta',
        'Environment :: Console',
        'Operating System :: POSIX :: Linux',
        'Framework :: AsyncIO',
        'Intended Audience :: Developers',
        'License :: OSI Approved :: Apache Software License',
        'Programming Language :: Python',
        'Programming Language :: Python :: 3.7',
        'Programming Language :: Python :: 3.8',
        'Programming Language :: Python :: 3 :: Only',
    ],
)
