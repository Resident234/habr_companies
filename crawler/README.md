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

Хабы статьи извлекаются из **всех** ссылок `a.tm-publication-hub__link`
внутри `.tm-publication-hubs`; парсер не ограничивается первым найденным
хабом. В том числе сохраняется ссылка на блог компании как хаб с кодом
компании. Код берётся из URL `/ru/hubs/{code}/` или `/ru/companies/{code}/`,
а title — из видимого текста ссылки. Завершающий маркер профильного хаба
`*`, который Habr отдаёт во вложенном `span.tm-article-snippet__profiled-hub`,
удаляется до сохранения. Связь статьи с каждым хабом записывается в
`article_hubs` (many-to-many). Справочники `hubs` и `labels` пополняются по
мере обнаружения новых значений (поиск по `code`; если записи нет — вставка).

## Установка

Требуется Python 3.7+.

```
cd crawler
python -m pip install -r requirements.txt
python -m pip install -e .
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
  ProfileUrlTemplate: 'https://habr.com/ru/companies/{company}/profile/'
  PostsUrlTemplate: 'https://habr.com/ru/companies/{company}/posts/'
  NewsUrlTemplate: 'https://habr.com/ru/companies/{company}/news/{news_id}/'
  NewsIdStart: 1
  NewsIdEnd: 10000000
  # Новые режимы пагинации (взаимоисключающие, проверяются сверху вниз):
  ArticlesMode: False       # True = собирать статьи через пагинацию /companies/{code}/articles/
  ArticlesUrlTemplate: 'https://habr.com/ru/companies/{company}/articles/'
  NewsPagesMode: False      # True = собирать новости через пагинацию /companies/{code}/news/
  NewsPagesUrlTemplate: 'https://habr.com/ru/companies/{company}/news/'
  # Старые режимы (перебор по ID):
  ProfileMode: False    # True = собирать отрасли из профилей компаний
  PostsMode: False      # True = собирать посты из ленты /companies/{code}/posts/
  NewsMode: False       # True = собирать новости перебором /companies/{code}/news/{id}/
  SeedBatchSize: 20000   # сколько URL держать в очереди на компанию

Crawl:
  MaxWorkers: 4         # параллельных запросов
  MaxHostQPS: 2          # запросов в секунду на хост (вежливость)
  MaxTries: 6
```

Описание параметров параллелизма:

| Параметр         | Где используется | По умолчанию | Описание |
|------------------|------------------|--------------|----------|
| `Crawl.MaxWorkers`  | `habrcrawler/__init__.py` | 10 | Число asyncio-воркеров, параллельно выполняющих полный цикл (DNS, robots, HTTP, парсинг, запись в БД) |
| `Crawl.MaxHostQPS`  | `habrcrawler/scheduler.py` | 2 | Максимум запросов в секунду на один хост (вежливость); планировщик сам расставляет задержки между запросами |
| `Database.MinPoolSize` | `habrcrawler/db.py` | 1 | Минимальный размер пула соединений aiomysql |
| `Database.MaxPoolSize` | `habrcrawler/db.py` | 10 | Максимальный размер пула соединений aiomysql; должен быть `>= MinPoolSize` |

Схему БД см. в `../sql/` (`create_articles_table.sql`,
`create_companies_table.sql`, `create_article_hubs_table.sql`,
`create_post_hubs_table.sql`, `create_news_hubs_table.sql`).

## Запуск

```
cd crawler
python -m scripts.crawl --configfile .habrcrawler-config.yml
```

Команда `python -m pip install -e .` устанавливает `habrcrawler` в активное виртуальное окружение в editable-режиме. После этого пакет находится через `PYTHONPATH` независимо от каталога, из которого запускается Python. Проверить установку можно командой `python -c "import habrcrawler; print(habrcrawler.__file__)"`.

Остановка — `Ctrl+C` (краулер завершится корректно). Повторный запуск
безопасен: статьи с уже существующим `id` пропускаются.

### Логирование и дедупликация

В режиме `DEBUG` часто встречаются два типа сообщений:

#### `DEBUG:habrcrawler:add_url no, reason rejected by crawled url ...`

Это означает, что механизм дедупликации отклонил URL, так как он **уже был обработан** или находится в очереди. Это штатная ситуация, возникающая при:
- **Повторной генерации сидов**: когда одни и те же ID из БД попадают в батч до того, как обновился статус в базе.
- **Пересечении режимов**: когда один и тот же URL находится и через перебор ID, и через пагинацию.
- **Редиректах**: когда разные ссылки ведут на одну и ту же каноническую страницу.

Это экономит трафик и предотвращает избыточную нагрузку на сервер.

#### `INFO:habrcrawler.seeds:Received a final failure for seed url ...`

Это означает, что краулер **окончательно отказался от попыток** скачать эту конкретную статью после исчерпания всех ретраев (по умолчанию `MaxTries: 6`). Причины:
- **HTTP 4xx/5xx ошибки**: страница не найдена (404), доступ запрещён (403), сервер недоступен (502/503/504)
- **Таймауты сети** или ошибки DNS
- **Блокировка бота** сайтом

Краулер записывает ошибку в лог, удаляет URL из очереди и продолжает обработку других статей. Это нормальное поведение — у любого сайта есть мёртвые ссылки. Если таких ошибок много, это может указывать на проблемы с доступом к Habr или устаревшие сиды.

Если окончательно не удалось загрузить детальную страницу контента, для которого уже был найден идентификатор в пагинации или при переборе по id, краулер выполняет **code-only fallback**. Для статьи, поста или новости в соответствующую таблицу (`articles`, `posts` или `news`) вставляется только `id` (в API это `code`); остальные поля остаются пустыми. Такая запись позволяет зафиксировать найденный контент без повторных сетевых попыток. Если строка с этим `id` уже существует, вставка пропускается и существующие данные не изменяются. Обработчик исчерпания попыток применяется к `article_id`, `post_id` и `news_id`; прогресс перебора при этом сохраняется как раньше.

Для постов detail-страницы `/companies/{code}/posts/{id}/` теперь также передаются в специализированный парсер, поэтому успешная загрузка и code-only fallback используют одинаковый жизненный цикл. В списокные режимы `PostsMode` и `NewsPagesMode`, где данные сохраняются непосредственно из страницы пагинации, эта логика не добавляет лишних запросов.

### Режим сбора отраслей компаний

Для сбора отраслей (категорий) компаний вместо статей установите
в `.habrcrawler-config.yml`:

```yaml
Habr:
  Enabled: True
  ProfileMode: True
```

В этом режиме краулер проходит по всем компаниям из таблицы `companies`,
открывает страницу профиля `https://habr.com/ru/companies/{code}/profile/`
и извлекает отрасли из блока `div.tm-company-profile__categories`.

Каждая отрасль сохраняется в таблицу `category` (code из URL вида
`/ru/companies/category/telecom/`, title — текст ссылки), а связь
компании с отраслью — в таблицу `company_categories`.

**Что было сделано для этого режима:**

1. **`habrcrawler/company_categories.py`** — новый модуль:
   - `HabrCompanyProfileSeedGenerator` — генерирует URL профилей
     `https://habr.com/ru/companies/{code}/profile/` для всех компаний из БД
   - `parse_categories_html()` — извлекает отрасли из
     `div.tm-company-profile__categories` (code из URL
     `/ru/companies/category/telecom/`, title — текст ссылки)
   - `parse_and_save_categories()` — сохраняет отрасли в таблицу `category`
     и связи в `company_categories`

2. **`habrcrawler/db.py`** — добавлены функции:
   - `get_or_create_category(code, title)` — поиск/создание отрасли
     с in-memory кэшем
   - `link_company_category(company_code, category_code)` — привязка
     отрасли к компании

3. **`habrcrawler/post_fetch.py`** — обработка профилей: при
   `profile_page=True` в ridealong вызывается парсер категорий вместо
   парсера статей

4. **`habrcrawler/__init__.py`** — поддержка режима `ProfileMode`: при
   `Habr.Enabled=True` и `Habr.ProfileMode=True` используется генератор
   профилей

5. **Конфигурация** — добавлены `ProfileMode` и `ProfileUrlTemplate`
   в `config.py` и `.habrcrawler-config.yml`

### Режим сбора постов компаний

Для сбора постов компаний (лента `/ru/companies/{code}/posts/`) вместо
статей установите в `.habrcrawler-config.yml`:

```yaml
Habr:
  Enabled: True
  PostsMode: True
```

В отличие от статей, у постов нет отдельных страниц под конкретным
article_id: вся лента постов живёт на пагинированных страницах вида

```
https://habr.com/ru/companies/{company_code}/posts/
https://habr.com/ru/companies/{company_code}/posts/page2/
...
```

Каждая страница содержит до 20 постов в блоках
`<article class="tm-articles-list__item">`; в разметке списка уже
есть всё нужное (заголовок, счётчики, хабы), поэтому отдельно посты
не скачиваются. Пагинация цепочечная: если распарсенная страница
содержала посты, парсер сам ставит в очередь страницу `page{N+1}`;
пустая страница завершает обход компании.

Для каждого поста (таблица `posts`) сохраняется:

| Поле               | Откуда |
|--------------------|--------|
| `id`               | атрибут `id` блока `<article>` (числовой) |
| `title`            | текст первого `<strong>` внутри статьи (внутри ссылки заголовка) |
| `stats_counter`    | атрибут `title` у `span.tm-icon-counter__value` (число просмотров) |
| `company`          | компания, чья страница постов обходится |
| `score_counter`    | текст внутри `.tm-votes-meter__value` |
| `bookmarks_counter`| текст внутри `button.bookmarks-button span.counter` |
| `comments_counter` | текст внутри `span.tm-article-comments-counter-link__value` (0 для «Нет комментариев») |

Хабы поста (ссылки `a.tm-publication-hub__link`) сохраняются в общий
справочник `hubs` и привязываются к посту через новую связную таблицу
`post_hubs` (many-to-many, см. `../sql/create_post_hubs_table.sql`).
Ссылка «Блог компании …» (`/ru/companies/{code}/posts/`) тоже даёт хаб
с кодом самой компании.

Повторный запуск безопасен: посты с уже существующим `id` пропускаются
по дубликату первичного ключа.

**Что было сделано для этого режима:**

1. **`habrcrawler/company_posts.py`** — новый модуль:
   - `HabrPostsSeedGenerator` — ставит в очередь первую страницу постов
     для каждой компании из БД (`posts_page_url(template, code, 1)`)
   - `parse_posts_list_html()` — извлекает посты из HTML списка
   - `parse_and_save_posts()` — сохраняет посты и хабы, при непустой
     странице ставит в очередь следующую страницу этой компании

2. **`habrcrawler/db.py`** — добавлены функции:
   - `insert_post(...)` — вставка поста (дубликаты по `id` пропускаются)
   - `link_post_hub(post_id, hub_code)` — привязка хаба к посту

3. **`habrcrawler/post_fetch.py`** — обработка страниц постов: при
   `posts_page=True` в ridealong вызывается парсер постов вместо
   парсера статей

4. **`habrcrawler/__init__.py`** — поддержка режима `PostsMode`: при
   `Habr.Enabled=True` и `Habr.PostsMode=True` используется генератор
   страниц постов

5. **Конфигурация** — добавлены `PostsMode` и `PostsUrlTemplate`
   в `config.py` и `.habrcrawler-config.yml`

6. **SQL** — `../sql/create_post_hubs_table.sql`: связка постов с хабами
   (по образцу `article_hubs`)

### Режим сбора новостей компаний

Для сбора новостей компаний вместо статей установите в
`.habrcrawler-config.yml`:

```yaml
Habr:
  Enabled: True
  NewsMode: True
```

Режим работает так же, как воркер статей: для каждой компании из
таблицы `companies` перебирается диапазон id от `NewsIdStart` до
`NewsIdEnd` (1..10 000 000 по умолчанию) по шаблону

```
https://habr.com/ru/companies/{company}/news/{news_id}/
```

Например: `https://habr.com/ru/companies/lanit/news/984896/`

Страница новости размечена так же, как страница статьи
(`h1.tm-title`, `span.tm-icon-counter__value`, `.tm-publication-hubs`,
`tm-votes-meter__value_rating` и т.д.), поэтому извлечение полей
переиспользует парсер статей; отличается только шаблон URL для
получения id. Найденные новости сохраняются в таблицу `news` (поля
аналогичны `articles`, за исключением отсутствия label). Хабы новости
сохраняются в справочник `hubs` и привязываются через связную таблицу
`news_hubs` (many-to-many, см. `../sql/create_news_hubs_table.sql`).

Прогресс сохраняется в отдельную колонку
`companies.last_processed_news_id` (тем же способом, что
`last_processed_article_id` для статей), поэтому перезапуск продолжает
перебор с `last_processed_news_id + 1`. Повторный запуск безопасен:
новости с уже существующим `id` пропускаются.

**Что было сделано для этого режима:**

1. **`habrcrawler/habr_news.py`** — новый модуль:
   - `HabrNewsSeedGenerator` — ленивая батчевая генерация URL новостей
     по компаниям из БД с round-robin чередованием (копия механики
     `HabrSeedGenerator`, но по диапазону `news_id`,
     `NewsUrlTemplate`, `NewsIdStart`, `NewsIdEnd`)

2. **`habrcrawler/habr_news_parse.py`** — новый модуль:
   - `NEWS_URL_RE` — шаблон `/ru/companies/{company}/news/{news_id}/`
   - `parse_and_save_news()` — извлекает поля через
     `parse_article_html()` (id берётся из `NEWS_URL_RE`), сохраняет
     новость в `news` и привязывает хабы

3. **`habrcrawler/db.py`** — добавлены функции:
   - `get_companies_news_progress()` — список компаний с прогрессом
     `last_processed_news_id`
   - `insert_news(...)` — вставка новости (дубликаты по `id`
     пропускаются)
   - `link_news_hub(news_id, hub_code)` — привязка хаба к новости
   - `update_company_news_progress(code, news_id)` — обновление
     прогресса через `GREATEST(...)`

4. **`habrcrawler/__init__.py`** — поддержка режима `NewsMode`: при
   `Habr.Enabled=True` и `Habr.NewsMode=True` используется генератор
   новостей; прогресс `last_processed_news_id` обновляется после
   финального исхода обработки каждого URL с `news_id`

5. **`habrcrawler/post_fetch.py`** — обработка страниц новостей: при
   `news_id` в ridealong вызывается парсер новостей вместо парсера
   статей

6. **Конфигурация** — добавлены `NewsMode`, `NewsUrlTemplate`,
   `NewsIdStart`, `NewsIdEnd` в `config.py` и `.habrcrawler-config.yml`

7. **SQL** — `../sql/create_news_hubs_table.sql` (связка news_hubs)
   и `../sql/add_last_processed_news_id_to_companies.sql` (идемпотентная
   миграция для существующих баз; для новых баз колонка уже включена в
   `../sql/create_companies_table.sql`)

### Code-only fallback и регрессионные изменения

В `db.py` добавлены `insert_article_code_only()`, `insert_post_code_only()` и
`insert_news_code_only()`. Они выполняют идемпотентную вставку идентификатора
без обновления уже существующей строки. В `__init__.py` обработка исчерпания
`Crawl.MaxTries` стала асинхронной, чтобы перед `seeds.fail()` сохранить найденный
код. В `post_fetch.py` добавлена маршрутизация detail-страниц постов через
`habr_post_parse.parse_and_save_post()`. Это покрывает недоступность detail-page
для всех трёх типов контента и не меняет обычную запись полноценных данных.

### Перебор постов компаний по id

Для сбора отдельных постов компаний (страницы вида
`https://habr.com/ru/companies/{code}/posts/{id}/`) установите в
`.habrcrawler-config.yml`:

```yaml
Habr:
  Enabled: True
  PostPagesMode: True
```

Режим работает так же, как воркер статей/новостей: для каждой компании
из таблицы `companies` перебирается диапазон id от `PostIdStart` до
`PostIdEnd` (1..10 000 000 по умолчанию) по шаблону

```
https://habr.com/ru/companies/{company}/posts/{post_id}/
```

Например: `https://habr.com/ru/companies/ruvds/posts/1064400/`

Страница поста — это не полноценная статья: нет `h1.tm-title`,
`.tm-publication-hubs` и `tm-votes-meter__value_rating`. Поэтому
заголовок, хабы и счётчик рейтинга извлекаются из встроенного
preloaded-state JSON (запись с `publicationType == "post"`), а счётчики
просмотров/закладок/комментариев — из уже знакомой иконочной вёрстки.
Найденные посты сохраняются в таблицу `posts` (поля аналогичны
`articles`, за исключением отсутствия label), хабы привязываются через
`post_hubs`.

Прогресс сохраняется в отдельную колонку
`companies.last_processed_post_id` (тем же способом, что
`last_processed_article_id` для статей и `last_processed_news_id` для
новостей), поэтому перезапуск продолжает перебор с
`last_processed_post_id + 1`. Повторный запуск безопасен: посты с уже
существующим `id` пропускаются.

**Что было сделано для этого режима:**

1. **`habrcrawler/habr_posts.py`** — новый модуль:
   - `HabrPostPagesSeedGenerator` — ленивая батчевая генерация URL
     постов по компаниям из БД с round-robin чередованием (копия
     механики `HabrNewsSeedGenerator`, но по диапазону `post_id`,
     `PostUrlTemplate`, `PostIdStart`, `PostIdEnd`)

2. **`habrcrawler/habr_post_parse.py`** — новый модуль:
   - `POST_URL_RE` — шаблон `/ru/companies/{company}/posts/{post_id}/`
   - `parse_post_html()` — извлекает поля из preloaded-state JSON
     (title, hubs, score) и иконочной вёрстки (views, bookmarks,
     comments)
   - `parse_and_save_post()` — сохраняет пост в `posts` и привязывает
     хабы

3. **`habrcrawler/db.py`** — добавлены функции:
   - `get_companies_posts_progress()` — список компаний с прогрессом
     `last_processed_post_id`
   - `update_company_posts_progress(code, post_id)` — обновление
     прогресса через `GREATEST(...)`

4. **`habrcrawler/__init__.py`** — поддержка режима `PostPagesMode`:
   при `Habr.Enabled=True` и `Habr.PostPagesMode=True` используется
   генератор постов; прогресс `last_processed_post_id` обновляется
   после финального исхода обработки каждого URL с `post_id`

5. **`habrcrawler/post_fetch.py`** — обработка страниц постов: при
   `post_id` в ridealong вызывается парсер постов вместо парсера
   статей/новостей; при окончательном исчерпании попыток для статей,
   постов и новостей вызывается code-only fallback из `db.py`

6. **Конфигурация** — добавлены `PostPagesMode`, `PostUrlTemplate`,
   `PostIdStart`, `PostIdEnd` в `config.py` и `.habrcrawler-config.yml`

7. **SQL** — `../sql/add_last_processed_post_id_to_companies.sql`
   (идемпотентная миграция для существующих баз; для новых баз колонка
   уже включена в `../sql/create_companies_table.sql`)

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
  прогресс — это верхняя граница: после возобновления часть ID может быть
  обработана повторно. Повторная запись с тем же `articles.id` не пропускается:
  crawler обновляет `title`, `label` и все поля `counter.*`, а поля `action_*`
  при краулинге сохраняет без изменений.
**Миграция существующей базы:**

```sql
-- MySQL 8.0.29+ / MariaDB 10.5+
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS last_processed_article_id BIGINT UNSIGNED NULL DEFAULT NULL;
```

(тот же скрипт лежит в `../sql/add_last_processed_article_id_to_companies.sql`;
для новых баз колонка уже включена в `../sql/create_companies_table.sql`)

**TODO:** зацикливание перебора и оптимизация с учётом уже известных
`article_id` — например, прочёсывание диапазонов между двумя соседними
известными `article_id`.

## Тесты

Юнит-тесты парсеров (на HTML-сниппетах из ТЗ, без сети и БД):

```
python -m pytest tests/test_habr_parse.py tests/test_habr_posts_parse.py tests/test_habr_news_parse.py -v
```

## Новые режимы пагинации (ArticlesPagesMode / NewsPagesMode)

Начиная с текущей версии поддерживаются режимы сбора данных с постраничной пагинацией вместо перебора по ID. Для статей важно различать два режима: `ArticlesMode` — старый перебор детальных страниц по диапазону числовых ID, а `ArticlesPagesMode` — обход страниц списка статей компании.

### ArticlesMode
- **Включение**: `Habr.ArticlesMode: True` при `Habr.ArticlesPagesMode: False`.
- **Принцип работы**: краулер перебирает детальные URL статей в диапазоне `ArticleIdStart..ArticleIdEnd`.
- **URL статьи**: `Habr.ArticleUrlTemplate` (по умолчанию `https://habr.com/ru/companies/{company}/articles/{article_id}/`).
- **Что сохраняется**: поля статьи в `articles` и связи с хабами в `article_hubs`.

### ArticlesPagesMode
- **Включение**: одновременно `Habr.ArticlesMode: True` и `Habr.ArticlesPagesMode: True`. В текущей логике `ArticlesMode` является общим переключателем Habr-обработки, поэтому для постраничного режима должны быть включены оба флага.
- **URL шаблон списка**: `Habr.ArticlesUrlTemplate` (по умолчанию `https://habr.com/ru/companies/{company}/articles/`); для страниц 2 и далее автоматически используется путь `/page{N}/`.
- **Принцип работы**: краулер ставит в очередь страницы списка статей компании (`page=1, 2, 3...`), извлекает из preview-блоков идентификаторы и ссылки статей, а затем ставит в очередь детальную страницу каждой найденной статьи. Следующая страница списка ставится в очередь, пока текущая страница содержит статьи; пустая страница завершает пагинацию.
- **Источник заголовка**: итоговый `articles.title` берётся с детальной страницы из `h1.tm-title.tm-title_h1`. Заголовок из preview-блока страницы списка не используется для финального сохранения при работе crawler.
- **Что сохраняется**: поля статьи в `articles` и связи с хабами в `article_hubs`.
- **Повторная обработка**: запись с уже существующим `articles.id` обновляется через upsert. Обновляются `title`, `label`, `stats_counter`, `score_counter`, `bookmarks_counter` и `comments_counter`; поля `action_*` при краулинге не изменяются.

### Приоритет режимов (проверяются сверху вниз)
1. `ProfileMode` — сбор отраслей из профилей компаний.
2. `PostsMode` — сбор постов через пагинацию `/posts/`.
3. **`ArticlesPagesMode` вместе с `ArticlesMode` — сбор статей через пагинацию `/articles/`**.
4. **`NewsPagesMode` — сбор новостей через пагинацию `/news/`**.
5. `NewsMode` — старый режим перебора новостей по ID (`/news/{id}/`).
6. `ArticlesMode` без `ArticlesPagesMode` — старый перебор статей по ID (`ArticleIdStart..ArticleIdEnd`).

> **Важно**: режимы взаимоисключающие — включите только один режим сбора Habr одновременно. Для `ArticlesPagesMode` необходимо включить оба флага: `ArticlesMode` и `ArticlesPagesMode`.

### Пример конфигурации для ArticlesPagesMode
```yaml
Habr:
  Enabled: True
  ArticlesMode: True
  ArticlesPagesMode: True
  ArticlesUrlTemplate: 'https://habr.com/ru/companies/{company}/articles/'
  # Остальные режимы должны быть False:
  CategoriesMode: False
  PostsMode: False
  NewsPagesMode: False
  NewsMode: False
```

### Пример конфигурации для NewsPagesMode
```yaml
Habr:
  Enabled: True
  NewsPagesMode: True
  NewsPagesUrlTemplate: 'https://habr.com/ru/companies/{company}/news/'
  ProfileMode: False
  PostsMode: False
  ArticlesMode: False
  NewsMode: False
```

### Структура данных (таблицы БД)
Новые режимы используют **те же таблицы**, что и старые:
- `articles` — статьи (при ArticlesMode)
- `news` — новости (при NewsPagesMode)
- `article_hubs` / `news_hubs` — связи с хабами
- `hubs` — справочник хабов (пополняется автоматически)

Разница только в **методе сбора**: пагинация списка вместо перебора ID.

### Источник данных статьи и upsert
В `ArticlesPagesMode` HTML страницы списка используется для обнаружения `article_id`, ссылки на детальную страницу и **всех** хабов. Если crawler передан в `parse_and_save_articles()`, preview-заголовок не сохраняется как итоговый `title`: детальная страница ставится в очередь с `article_id` и полным списком найденных хабов, после чего обрабатывается `habr_parse.parse_and_save()`. Этот парсер берёт заголовок из `h1.tm-title.tm-title_h1`, объединяет хабы detail-страницы с хабами из preview по `code` и записывает каждую уникальную связь в `article_hubs`. Поэтому частичный detail-ответ или redirect не приводит к потере хаба, уже найденного на странице списка.

Сохранение выполняется через upsert по первичному ключу `articles.id`. При существующей записи crawler обновляет `title`, `label`, `stats_counter`, `score_counter`, `bookmarks_counter` и `comments_counter`. Любые `action_*` поля не входят в update-часть и поэтому не изменяются при краулинге.

### Как это работает внутри
1. **Генераторы сидов** (`habrcrawler/company_articles.py`, `habrcrawler/company_news.py`) создают `HabrArticlesSeedGenerator` / `HabrNewsSeedGenerator`.
2. При старте для каждой компании ставится в очередь **первая страница** (`page=1`).
3. В `post_fetch.py` при обработке ответа с флагом `articles_page` / `news_page` вызывается `parse_and_save_articles()` / `parse_and_save_news()`.
4. Для статей parser извлекает preview-данные, все хабы и ставит в очередь детальные URL вместе с этим списком; для новостей записи сохраняются из страницы списка.
5. При обработке детальной статьи `post_fetch.py` передаёт сохранённый список preview-хабов в `habr_parse.parse_and_save()`. Парсер объединяет его с хабами detail-страницы, делает upsert статьи и вызывает `link_article_hub()` для каждой уникальной связи.
6. Если на странице были записи, генератор автоматически ставит в очередь **следующую страницу** (`page+1`).
7. Процесс продолжается, пока страница не вернётся пустой.

### Ограничение скорости
Rate limit `Crawl.MaxHostQPS` (по умолчанию 2 rps на `habr.com`) применяется ко всем режимам одинаково. Пагинация не увеличивает нагрузку — она просто заменяет много несуществующих ID на реальные страницы.

---

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
- `habrcrawler/habr_news.py` — то же самое для новостей (перебор
  `NewsIdStart..NewsIdEnd` по
  `https://habr.com/ru/companies/{company}/news/{news_id}/`).
- `habrcrawler/company_categories.py` — генерация URL профилей компаний
  и извлечение отраслей (категорий) из HTML профиля.
- `habrcrawler/company_posts.py` — генерация URL страниц постов
  компаний (`/ru/companies/{code}/posts/`) и извлечение постов из HTML
  списка с цепочной пагинацией.
- `habrcrawler/habr_parse.py` — извлечение полей статьи из HTML
  (BeautifulSoup + lxml) и запись в БД.
- `habrcrawler/habr_news_parse.py` — то же для страниц новостей
  (переиспользует `habr_parse`, отличие — только шаблон URL с id).
- `habrcrawler/db.py` — асинхронный слой MySQL (aiomysql): компании,
  справочники hubs/labels/category с in-memory кэшем, вставка статей,
  новостей, постов и связей, обновление прогресса.
- `habrcrawler/post_fetch.py` — точка входа обработки скачанной страницы.
- `scripts/crawl.py` — главная программа.

## License

Apache 2.0
Source launch requires a full Git checkout with the parent .git directory.

## Network and database retry behavior

Transient `aiohttp` failures such as `ServerDisconnectedError` are retryable. The crawler requeues the affected URL while `retries_left` remains positive; a `we failed working on ...` line describes one failed attempt and is not, by itself, proof that the URL was permanently lost. The final crawler log records `retries_left: 0` when all attempts are exhausted.

Article hub links are stored idempotently with `ON DUPLICATE KEY UPDATE`, so rerunning a page does not create duplicate-key warnings. Hub titles are normalized before persistence; when an existing hub row still contains the legacy trailing `*`, the next crawl updates that row to the clean title. For an immediate cleanup of already stored rows, run `../sql/normalize_hub_titles.sql` once; the migration is idempotent. Article upserts use the MySQL row-alias form (`new.column`) instead of the deprecated `VALUES(column)` form.
## Recommended Crawl profile

The current Windows configuration uses a conservative Habr request profile:

```yaml
Crawl:
  MaxTries: 6
  ConnectTimeout: 20.
  PageTimeout: 45.
  RetryTimeout: 5
  MaxWorkers: 4
  MaxHostQPS: 2
```

This profile reduces concurrent requests and host rate while allowing transient `ServerDisconnectedError` failures to be retried. `RetryTimeout` is retained as a configuration value; the current retry queue does not yet enforce a fixed sleep before requeueing.
### Idempotent relation inserts

Many-to-many relation writers for `article_hubs`, `post_hubs`, `news_hubs`, and `company_categories` use `INSERT ... ON DUPLICATE KEY UPDATE` with a no-op assignment. This makes repeated crawler runs safe and avoids the MySQL warning generated by `INSERT IGNORE` when an existing relation is encountered. The article row itself continues to use its metadata upsert, while `action_*` fields remain untouched.

### Hub parsing regression coverage

The parser regression fixture for `https://habr.com/ru/companies/ruvds/articles/1057964/` contains the company blog link plus four ordinary hubs. The test verifies that all five links from `.tm-publication-hubs` are returned and that titles such as `Бизнес-модели *` are stored as `Бизнес-модели`. A save-path regression test verifies that hubs found on the list page are merged with a partial detail response and that every resulting code is passed to `link_article_hub()`. Database tests additionally verify that a legacy row such as `Веб-разработка *` is repaired on the next crawl. The same normalization is applied to article, post, and news list/detail hub paths. The live database audit found 65,518 articles, 240,699 article-hub links, and 65,388 articles with at least one link; the remaining 130 zero-link rows include 128 empty-title placeholders and two redirected special pages, not ordinary articles missing parsed hubs.
## Monitoring and performance metrics

The crawler uses the existing `habrcrawler.stats` infrastructure and emits a consolidated report from `Crawler.minute()` once per minute and once during shutdown. The report keeps cumulative counters, current gauges, and interval rates in the same log stream; it does not create a second monitoring subsystem.

| Metric | Interpretation |
|---|---|
| `fetch ClientError` | Cumulative count of caught `aiohttp.ClientError` failures. Retry eligibility is decided separately by the retry policy. |
| `fetch error <ClientErrorType>` | Cumulative type-specific breakdown, for example `fetch error ServerDisconnectedError` or `fetch error ClientConnectorError`. The `robots ` prefix is retained for robots.txt requests. |
| `retries requeued` | Attempts that were successfully put back into the scheduler because retries remained. |
| `retries completely exhausted` | Attempts for which no retry remained and the URL was failed. |
| `queue size`, `ridealong size` | Current scheduler queue and metadata-map sizes. `max queue size` records the observed high-water mark. |
| `active workers`, `active retries`, `active coroutines` | Current worker count, workers processing a requeued item, and aggregate coroutine-state count. |
| `articles per minute` | Article rows inserted or updated during the latest reporting interval. |
| `news per minute`, `posts per minute` | News or post rows inserted during the latest reporting interval. |
| `pages per minute` | HTTP responses received and counted by `fetch URLs` during the latest reporting interval. |
| `client errors per minute` | New `fetch ClientError` failures for main page fetches during the latest reporting interval; robots.txt errors use their own prefix. |

The interval metrics are calculated from differences between cumulative counters, so they describe the period since the previous minute report rather than the whole crawl. The first report establishes a baseline and therefore may show zero rates. Existing `fetcher fetching` latency histograms remain available in the same report with 50th, 90th, 95th, and 99th percentiles.

For diagnosing the Habr `ServerDisconnectedError` pattern, inspect `fetch error ServerDisconnectedError`, `retries requeued`, `retries completely exhausted`, `active retries`, `queue size`, and `pages per minute` together. A growing detailed error counter with retries being requeued but a stable exhausted counter indicates transient recovery; a growing exhausted counter indicates that the configured `MaxTries` budget is being consumed.