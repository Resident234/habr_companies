# Habr Companies Article Parser

Парсер статей компаний с Хабра, построенный на асинхронном
asyncio-краулере.

Для каждой компании из таблицы `companies` перебираются страницы вида:

```
https://habr.com/ru/companies/{company_code}/articles/{article_id}/
```

где `article_id` пробегает диапазон от 1 до 10 000 000 (настраивается).
Найденные статьи разбираются и сохраняются в MySQL.

## Что сохраняется

Для каждой статьи (таблица `articles`):

| Поле               | Откуда |
|--------------------|--------|
| `id`               | номер статьи из URL |
| `title`            | текст внутри `h1.tm-title span` |
| `stats_counter`    | атрибут `title` у `span.tm-icon-counter__value` (число просмотров) |
| `label`            | FK на `labels` — `div.publication-label.variant-*` |
| `company`          | FK на `companies(code)` — компания, для которой шёл перебор |
| `score_counter`    | текст внутри `.tm-votes-meter__value_rating` |
| `bookmarks_counter`| текст внутри `button.bookmarks-button span.counter` |
| `comments_counter` | текст внутри `a.article-comments-counter-link span.value` |

Хабы статьи (ссылки `a.tm-publication-hub__link` внутри
`.tm-publication-hubs`) сохраняются в справочник `hubs`
(code — из URL `/ru/hubs/{code}/`, title — текст ссылки) и
привязываются к статье через связную таблицу `article_hubs`
(many-to-many). Справочники `hubs` и `labels` пополняются по мере
обнаружения новых значений (поиск по `code`/`title`, если нет —
вставка).

## Установка

Требуется Python 3.7+.

```
cd crawler
pip install -r requirements.txt
```

## Настройка

Параметры подключения к MySQL и диапазон перебора задаются в
`.habrcrawler-config.yml` (лежит в корне `crawler/`):

```yaml
Database:
  Host: localhost
  Port: 3306
  User: root
  Password: ''
  Name: habr
  MinPoolSize: 1         # минимальный размер пула MySQL
  MaxPoolSize: 10        # максимальный размер пула MySQL

Habr:
  Enabled: True
  ArticleIdStart: 1
  ArticleIdEnd: 10000000
  UrlTemplate: 'https://habr.com/ru/companies/{company}/articles/{article_id}/'
  SeedBatchSize: 20000   # сколько URL держать в очереди на компанию

Crawl:
  MaxWorkers: 10         # параллельных запросов
  MaxHostQPS: 2          # запросов в секунду на хост (вежливость)
  MaxTries: 3
```

Описание параметров параллелизма:

| Параметр         | Где используется | По умолчанию | Описание |
|------------------|------------------|--------------|----------|
| `Crawl.MaxWorkers`  | `habrcrawler/__init__.py` | 10 | Число asyncio-воркеров, параллельно выполняющих полный цикл (DNS, robots, HTTP, парсинг, запись в БД) |
| `Crawl.MaxHostQPS`  | `habrcrawler/scheduler.py` | 10 | Максимум запросов в секунду на один хост (вежливость); планировщик сам расставляет задержки между запросами |
| `Database.MinPoolSize` | `habrcrawler/db.py` | 1 | Минимальный размер пула соединений aiomysql |
| `Database.MaxPoolSize` | `habrcrawler/db.py` | 10 | Максимальный размер пула соединений aiomysql; должен быть `>= MinPoolSize` |

Схему БД см. в `../sql/` (`create_articles_table.sql`,
`create_companies_table.sql`, `create_article_hubs_table.sql`).

## Запуск

```
cd crawler
python scripts/crawl.py --configfile .habrcrawler-config.yml
```

Остановка — `Ctrl+C` (краулер завершится корректно). Повторный запуск
безопасен: статьи с уже существующим `id` пропускаются.

## Сохранение прогресса

Краулер ведёт прогресс по каждой компании отдельно: в таблице
`companies` есть колонка `last_processed_article_id`, куда
записывается последний обработанный `article_id`.

- **При запуске** каждая компания продолжает обход с
  `last_processed_article_id + 1`; компании без сохранённого прогресса
  начинают с `ArticleIdStart`. Если у компании прогресс дошёл до
  `ArticleIdEnd`, она пропускается.
- **Прогресс обновляется** после финального исхода обработки каждой
  страницы: 2xx (статья найдена), редирект или неустранимая ошибка
  (4xx/1xx). Временные ошибки (5xx, 429, таймауты) попадают на ретраи
  и прогресс **не** двигают — после исчерпания `MaxTries` они
  считаются обработанными и тоже фиксируются.
- Обновление идёт через
  `UPDATE ... SET last_processed_article_id = GREATEST(...)`, поэтому
  параллельная обработка разных `article_id` одной компании не может
  откатить прогресс назад.
- Воркеры обрабатывают URL в произвольном порядке, поэтому сохранённый
  прогресс — это верхняя граница: после возобновления часть ID может
  быть обработана повторно, но дубликаты пропускаются по первичному
  ключу `articles.id`.

**Миграция существующей базы:**

```sql
-- MySQL 8.0.29+ / MariaDB 10.5+
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS last_processed_article_id BIGINT UNSIGNED NULL DEFAULT NULL;
```

(тот же скрипт лежит в `../sql/add_last_processed_article_id_to_companies.sql`;
для новых баз колонка уже включена в `../sql/create_companies_table.sql`)

## Тесты

Юнит-тест парсера (на HTML-сниппетах из ТЗ, без сети и БД):

```
python -m pytest tests/test_habr_parse.py -v
```

## Параллелизм и порядок обхода компаний

Краулер однопроцессный, построен на asyncio. Параллелизм устроен так:

1. **Пул асинхронных воркеров.** В `Crawler.crawl()`
   (`habrcrawler/__init__.py`) создаётся `MaxWorkers` (по умолчанию 10)
   asyncio-тасков `work()`. Каждый в цикле берёт URL из общей
   `asyncio.PriorityQueue` и выполняет полный цикл: DNS, robots.txt,
   HTTP-запрос, парсинг, запись в MySQL. Всё это неблокирующее
   (aiohttp + aiomysql), поэтому 10 воркеров реально работают
   параллельно в одном потоке.

2. **Генерация URL — round-robin по компаниям.**
   `HabrSeedGenerator` (`habrcrawler/habr_seeds.py`) лениво подкидывает
   в очередь батчи по `SeedBatchSize` (20000) URL, чередуя компании
   по кругу: по одному article_id от каждой компании в батче. Прогресс
   идёт равномерно по всем компаниям сразу — не нужно ждать, пока
   закончится диапазон одной компании, чтобы началась следующая.

3. **Ограничивающий фактор — rate limit на хост.** Планировщик
   (`habrcrawler/scheduler.py`) применяет `MaxHostQPS: 2` к ключу хоста
   (`habr.com`), т.е. суммарно по всем воркерам выходит ~2 запроса/сек.
   Плюс `control_limit()` динамически подстраивает лимит соединений
   aiohttp. Поэтому увеличение `MaxWorkers` выше ~10–20 почти ничего не
   даст: все URL лежат на одном хосте.

### Что это значит для «парсинга нескольких компаний одновременно»

- **Сейчас:** round-robin уже реализован — компании продвигаются
  равномерно, по одному article_id от каждой в батче. Параллельно
  идут HTTP-запросы к разным article_id разных компаний
  (с потолком ~2 rps по habr.com).
- **Если нужен настоящий многопроцессный параллелизм** (несколько
  компаний в разных процессах): можно запускать несколько экземпляров
  `scripts/crawl.py` с разными подмножествами компаний (например,
  фильтр в `get_companies()` по `code % N = i`), но глобальный лимит
  2 rps на habr.com всё равно придётся соблюдать суммарно, иначе бан.

Практический вывод: узкое место — не CPU и не число воркеров, а
вежливый rate limit к habr.com. Round-robin генерация ID по компаниям
уже обеспечивает равномерный прогресс по всем компаниям.

## Структура


- `habrcrawler/habr_seeds.py` — ленивая батчевая генерация URL статей
  по компаниям из БД с round-robin чередованием (весь диапазон 1..10M
  в очередь не помещается, поэтому URL подкладываются порциями по мере
  опустошения очереди, по одному article_id от каждой компании в батче).
- `habrcrawler/habr_parse.py` — извлечение полей статьи из HTML
  (BeautifulSoup + lxml) и запись в БД.
- `habrcrawler/db.py` — асинхронный слой MySQL (aiomysql): компании,
  справочники hubs/labels с in-memory кэшем, вставка статей и связей.
- `habrcrawler/post_fetch.py` — точка входа обработки скачанной страницы.
- `scripts/crawl.py` — главная программа.

## License

Apache 2.0
