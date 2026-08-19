.PHONY: init pytest test pylint clean_coverage test_coverage install

init:
	pip install --upgrade pip
	pip install -r requirements.txt


pytest:
	PYTHONPATH=. py.test tests/test_habr_parse.py tests/unit

test: pytest

pylint:
	PYTHONPATH=. pylint habrcrawler scripts

clean_coverage:
	rm -f .coverage
	rm -f .coverage.*
	rm -f tests/.coverage
	rm -f tests/.coverage.*

test_coverage: clean_coverage
	PYTHONPATH=. py.test --cov-report=xml --cov-append --cov habrcrawler tests/test_habr_parse.py tests/unit
	coverage report

install:
	python -m pip install -e .
