# Модель данных `habr_companies`

Документ описывает **актуальное** состояние схемы MySQL-базы `habr_companies`,
которую наполняет краулер (`crawler/`) и читает/дополняет REST API (`rest-api/`).

Источники истины:
- *«Живая» БД* — снято с реальной схемы (information_schema) — это то, что
  реально работает сейчас.
- DDL-скрипты в этой папке (`sql/`) — то, чем база создаётся/мигрируется.

Все текстовые значения — `utf8mb4`. Справочники и связные таблицы объявлены с
collation `utf8mb4_unicode_ci`; колонки `action_*` и `statuses.code` — c
`utf8mb4_0900_ai_ci` (см. раздел «Collation и внешние ключи»).

---

## 1. Обзор таблиц

| Таблица             | Тип        | Назначение |
|---------------------|-----------|------------|
| `companies`         | сущность  | Компании Хабра (карточки). Источник сидов для краулера. |
| `category`          | справочник| Категории (отрасли) компаний. |
| `company_categories`| связь N:M | Компании ↔ категории. |
| `hubs`              | справочник| Хабы Хабра. |
| `labels`            | справочник| Метки (label) статей. |
| `articles`          | контент   | Статьи компаний (URL …/articles/). |
| `posts`             | контент   | Посты из списка компании (…/posts/). |
| `news`              | контент   | Новости компаний (…/news/{id}/). |
| `article_hubs`      | связь N:M | Статьи ↔ хабы. |
| `post_hubs`         | связь N:M | Посты ↔ хабы. |
| `news_hubs`         | связь N:M | Новости ↔ хабы. |
| `statuses`          | справочник| Статусы обработки для полей `action_*`. |

---

## 2. Сущности

### `companies` — компании
Хранит компании, собранные краулером, и служебный прогресс обхода.

| Поле                        | Тип              | NULL | Ключ | По умолч. | Описание |
|-----------------------------|------------------|------|------|-----------|----------|
| `code`                      | `VARCHAR(255)`   | NO   | **PK** | —       | Код/slug компании (например `lanit`). |
| `title`                     | `VARCHAR(255)`   | NO   |      | —         | Название компании. |
| `last_processed_article_id` | `BIGINT UNSIGNED`| YES  |      | NULL      | Последний обработанный `article_id` (прогресс краулера, `GREATEST`, не убывает). |
| `last_processed_news_id`    | `BIGINT UNSIGNED`| YES  |      | NULL      | Последний обработанный `news_id` (прогресс краулера). |

> ⚠️ **Расхождение DDL ↔ живая БД.** В `create_companies_table.sql` и
> `add_link_to_companies.sql` есть колонка `link VARCHAR(512)` (URL сайта
> компании со страницы профиля), и код `db.py:update_company_link()` в неё
> пишет. Но в **текущей живой БД этой колонки нет**. Либо примените
> `add_link_to_companies.sql`, либо учитывайте, что сайт компании сейчас не
> сохраняется.

### Контентные таблицы: `articles`, `posts`, `news`
Три однородные таблицы. Поля заполняет краулер при парсинге страниц Хабра.

**Общие поля (все три):**

| Поле               | Тип            | NULL | Ключ | По умолч. | Описание |
|--------------------|----------------|------|------|-----------|----------|
| `id`               | `INT`          | NO   | **PK** | auto_increment | Идентификатор публикации на Хабре. |
| `title`            | `VARCHAR(255)` | NO   |      | —         | Заголовок. |
| `stats_counter`    | `VARCHAR(255)` | YES  |      | NULL      | Счётчик просмотров (строкой, как на странице). |
| `company`          | `VARCHAR(255)` | YES  | MUL → `companies(code)` | NULL | Код компании-владельца. FK: `ON UPDATE CASCADE, ON DELETE SET NULL`. |
| `score_counter`    | `INT`          | YES  |      | NULL      | Рейтинг. |
| `bookmarks_counter`| `INT`          | YES  |      | NULL      | Число закладок. |
| `comments_counter` | `INT`          | YES  |      | NULL      | Число комментариев. |

**Поля рабочего процесса `action_*` (все три, добавлены миграцией
`create_statuses_and_action_columns.sql`):** каждое — FK к
`statuses(code)`, `NOT NULL`, по умолчанию `'unprocessed'`, правила
`ON UPDATE CASCADE, ON DELETE NO ACTION`.

| Поле              | Тип             | По умолч.    | FK |
|-------------------|----------------|--------------|----|
| `action_dev`      | `VARCHAR(255)` | `unprocessed` | → `statuses(code)` |
| `action_post`     | `VARCHAR(255)` | `unprocessed` | → `statuses(code)` |
| `action_comment`  | `VARCHAR(255)` | `unprocessed` | → `statuses(code)` |
| `action_industry` | `VARCHAR(255)` | `unprocessed` | → `statuses(code)` |
| `action_company`  | `VARCHAR(255)` | `unprocessed` | → `statuses(code)` |

**Отличие `articles`:** дополнительно поле метки.

| Поле    | Тип            | NULL | Ключ | FK |
|---------|----------------|------|------|----|
| `label` | `VARCHAR(255)` | YES  | MUL  | → `labels(code)`, `ON DELETE SET NULL` |

`posts` и `news` метки (`label`) не имеют.

---

## 3. Справочники

Все справочники имеют вид `(code PK, title)`. Код генерируется краулером
(для `labels` при отсутствии кода — derive из title).

| Таблица    | Поля                        | Запись |
|------------|-----------------------------|--------|
| `category` | `code` PK, `title` NOT NULL | Отрасли компаний. |
| `hubs`     | `code` PK, `title` NOT NULL | Хабы Хабра. Завершающий маркер `*` не хранится; существующие строки очищаются `normalize_hub_titles.sql`. |
| `labels`   | `code` PK, `title` NOT NULL | Метки статей. |
| `statuses` | `code` PK, `title` NOT NULL | Статусы `action_*` (см. ниже). |

### Содержимое `statuses`
Заполняется миграцией `create_statuses_and_action_columns.sql`:

| `code`        | `title`         |
|---------------|-----------------|
| `unprocessed` | Не обработано   |
| `backlog`     | В бэклоге       |
| `in_progress` | В работе        |
| `done`        | Завершено       |
| `rejected`    | Отклонено       |

---

## 4. Связные таблицы (many-to-many)

Все N:M таблицы имеют составной первичный ключ и каскадное удаление связей при
удалении родителя. Правила для всех: `ON UPDATE NO ACTION, ON DELETE CASCADE`.

| Таблица             | Поля (PK)                       | Связи |
|---------------------|---------------------------------|-------|
| `company_categories`| `company_code`, `category_code` | `company_code → companies(code)`, `category_code → category(code)` |
| `article_hubs`      | `article_id`, `hub_code`        | `article_id → articles(id)`, `hub_code → hubs(code)` |
| `post_hubs`         | `post_id`, `hub_code`           | `post_id → posts(id)`, `hub_code → hubs(code)` |
| `news_hubs`         | `news_id`, `hub_code`           | `news_id → news(id)`, `hub_code → hubs(code)` |

---

## 5. Диаграмма связей

```
                       companies
                          │ code (PK)
        ┌─────────────────┼──────────────────────────────┐
        │ (company)       │ (company)                    │ (company)
    articles            posts                           news
    id (PK) ──┐         id (PK) ──┐                   id (PK) ──┐
    label ────┼──→ labels         │                            │
              │                   │                            │
        article_hubs            post_hubs                    news_hubs
        (article_id, hub_code)  (post_id, hub_code)         (news_id, hub_code)
              └──→ hubs ←───────┴──────────────┬──────────────┘
                                                │ code (PK)

    statuses code (PK) ←── action_dev/post/comment/industry/company
                           (по 5 FK в каждой из articles/posts/news)

    category code (PK) ←── company_categories ──→ companies(code)
```

---

## 6. Collation и внешние ключи (важно при миграциях)

MySQL требует, чтобы колонки-кандидаты и referenced-колонки FK имели
**одинаковый** charset **и** collation, иначе `ALTER TABLE … ADD CONSTRAINT`
падает с ошибкой **3780**.

- Справочники (`hubs`, `labels`, `category`, `companies`, N:M) исторически
  имеют `utf8mb4_unicode_ci`.
- Контентные таблицы (`articles`, `posts`, `news`) фактически созданы с
  collation соединения по умолчанию — `utf8mb4_0900_ai_ci`.
- Поэтому в `create_statuses_and_action_columns.sql` для `statuses.code` явно
  задан `COLLATE utf8mb4_0900_ai_ci` и выполняется нормализация
  `ALTER TABLE statuses MODIFY COLUMN code … COLLATE utf8mb4_0900_ai_ci`, чтобы
  FK `action_* → statuses(code)` работали.
- При создании новых справочников/FK к контентным таблицам держите collation
  согласованным (см. также существующий скрипт `fix_code_collation.sql`).

---

## 7. Карта файлов `sql/`

| Файл | Что делает |
|------|-----------|
| `create_db.sql` | `CREATE DATABASE IF NOT EXISTS habr_companies`. |
| `create_companies_table.sql` | Таблица `companies` (вкл. `link`). |
| `create_articles_table.sql` | `hubs`, `labels`, `articles`. |
| `create_posts_table.sql` | Таблица `posts`. |
| `create_news_table.sql` | Таблица `news`. |
| `create_category_table.sql` | Справочник `category`. |
| `create_article_hubs_table.sql` | N:M `article_hubs`. |
| `create_post_hubs_table.sql` | N:M `post_hubs`. |
| `create_news_hubs_table.sql` | N:M `news_hubs`. |
| `create_company_categories_table.sql` | N:M `company_categories`. |
| `add_company_fk_to_content_tables.sql` | `company` + FK в `articles/news/posts`. |
| `add_last_processed_article_id_to_companies.sql` | Прогресс `last_processed_article_id`. |
| `add_last_processed_news_id_to_companies.sql` | Прогресс `last_processed_news_id`. |
| `add_link_to_companies.sql` | Колонка `link` (сайт компании) — *в живой БД пока не применена*. |
| `fix_code_collation.sql` | Нормализация collation `code` в `companies`/`category`. |
| `migrate_hubs_to_code.sql` | Миграция `hubs`/`article_hubs` на PK `code`. |
| `migrate_labels_to_code.sql` | Миграция `labels`/`articles.label` на PK `code`. |
| `drop_hub_from_*.sql` | Удаление устаревшей колонки `hub` из контентных таблиц. |
| `create_statuses_and_action_columns.sql` | Справочник `statuses` + поля `action_*` и FK. |
| `apply_statuses_migration.py` | Идемпотентный применяющий скрипт миграции statuses/action_* (pymysql). |
| `mysql-init.txt` | Установка пароля root для локального MySQL-сервера. |

---

## 8. Кто чём пользуется

- **Краулер** (`crawler/habrcrawler/db.py`) пишет в `companies`, `articles`,
  `posts`, `news`, справочники и N:M связи; колонки `action_*` он пока не
  трогает (оставляются в значении по умолчанию `unprocessed`).
- **REST API** (`rest-api/`) работает с `companies` (добавление/выборка).
- Поля `action_*` — для будущего рабочего процесса обработки контента
  (статусы берутся из `statuses`).

