# Сервис компаний

REST API для добавления и обновления компаний. Клиент — Chrome-расширение.

## Архитектура

```
rest-api/
├── operate/           # точка входа: .env, конфиг, InitDB, ListenAndServe
├── route/             # HTTP-маршруты, валидация, формирование JSON-ответов
├── middleware/        # HTTP-обёртки (аутентификация по API-ключу)
├── dbOp/              # модели и операции с MySQL
├── scripts/           # скрипты автоматизации
│   └── start_all.ps1  # запуск rest-api + ngrok одной командой
├── .env.example       # шаблон конфигурации
└── README.md
```

## Конфигурация

Параметры задаются переменными окружения:

| Переменная        | Описание                       | Пример                     |
|-------------------|--------------------------------|----------------------------|
| `DB_HOST`         | Хост и порт MySQL              | `127.0.0.1:3306`           |
| `DB_USER`         | Пользователь MySQL             | `root`                     |
| `DB_PASSWORD`     | Пароль MySQL                   | (пусто или ваш пароль)     |
| `DB_NAME`         | Имя базы данных                | `habr_companies`           |
| `COMPANY_API_KEY` | Секретный ключ API             | `c5f8a9d1e3b2...`         |
| `NGROK_AUTHTOKEN` | Токен ngrok (для start_all.ps1)| `3HEYVcOLgvIDP...`         |
| `NGROK_EXE`       | Путь к ngrok.exe (опц.)        | `C:\tools\ngrok.exe`       |
| `HTTP_ADDR`       | Адрес HTTP-сервера (опц.)      | `:8080`                    |

Скопируйте `.env.example` в `.env` и заполните реальные значения. При старте `operate` загружает `.env` из рабочей директории, проверяет обязательные переменные и подключается к MySQL до `ListenAndServe`. Если `.env` нет — используются переменные из IDE/shell; уже заданные переменные не перезаписываются.

## API

### Добавление / обновление компании

```text
POST /company/add/{code}/{title}
X-API-Key: <секретный-ключ>
```

- `code` — латинские буквы, цифры, `_`, `-`, 1–255 символов.
- `title` — передаётся в URL-кодированном виде (`encodeURIComponent`), 1–255 символов после декодирования.

**Ответы:**

- `201 Created` — компания создана;
- `200 OK` — существующая компания обновлена;
- `400 Bad Request` — невалидные параметры;
- `401 Unauthorized` — неверный или отсутствующий API-ключ;
- `500 Internal Server Error` — ошибка сервера.

**Пример:**

```bash
curl -X POST \
  "http://localhost:8080/company/add/yandex/%D0%AF%D0%BD%D0%B4%D0%B5%D0%BA%D1%81" \
  -H "X-API-Key: my-secret-key"
```

### Быстрое добавление компании/отрасли

```text
POST /company/quick-add
POST /category/quick-add
X-API-Key: <секретный-ключ>
Content-Type: application/json
```

**Тело запроса** (JSON):
```json
{ "title": "Яндекс" }
```

**Ответы:**
- `201 Created` — запись создана (в `companies` или `category`).
- `200 OK` — запись уже существует (в `companies` или `category`).
- `400 Bad Request` — неверный `title` (пустой или слишком длинный).
- `401 Unauthorized` — неверный API‑ключ.
- `500 Internal Server Error` — ошибка сервера.

**Пример:**
```bash
# Добавить компанию
curl -X POST "http://localhost:8080/company/quick-add" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-secret-key" \
  -d '{"title":"Яндекс"}'

# Добавить отрасль
curl -X POST "http://localhost:8080/category/quick-add" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-secret-key" \
  -d '{"title":"Финтех"}'
```

**Примечание:** сервер генерирует `code` из `title` с помощью транслитерации кириллицы в латиницу.

### Закладки комментариев

Добавление и удаление закладок комментариев (используется Chrome-расширением
при клике на ★ в интерфейсе Habr).

#### Добавление закладки комментария

```text
POST /comment/add
X-API-Key: <секретный-ключ>
Content-Type: application/json
```

**Тело запроса** (JSON):
```json
{
  "text": "Текст комментария (до 500 символов)",
  "entity_code": "posts",
  "entity_id": 1064400,
  "comment_id": 29901582
}
```

- `text` — текст комментария (извлекается расширением из DOM);
- `entity_code` — тип сущности: `posts`, `articles` или `news`;
- `entity_id` — числовой ID сущности (поста, статьи или новости);
- `comment_id` — числовой ID комментария на Habr.

**Ответы:**
- `201 Created` — закладка создана;
- `200 OK` — закладка уже существует;
- `400 Bad Request` — невалидные параметры;
- `401 Unauthorized` — неверный API-ключ;
- `500 Internal Server Error` — ошибка сервера.

**Пример:**
```bash
curl -X POST "http://localhost:8080/comment/add" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: my-secret-key" \
  -d '{"text":"Комментарий","entity_code":"posts","entity_id":1064400,"comment_id":29901582}'
```

#### Удаление закладки комментария

```text
DELETE /comment/{commentId}
X-API-Key: <секретный-ключ>
```

- `commentId` — числовой ID комментария.

**Ответы:**
- `204 No Content` — закладка удалена;
- `404 Not Found` — закладка не найдена;
- `401 Unauthorized` — неверный API-ключ;
- `500 Internal Server Error` — ошибка сервера.

**Пример:**
```bash
curl -X DELETE "http://localhost:8080/comment/29901582" \
  -H "X-API-Key: my-secret-key"
```

**Примечание:** Chrome-расширение вызывает эти эндпоинты при клике на ★ в
интерфейсе комментариев Habr. Сущность и её ID определяются из URL страницы
или мета-тега `og:url`.

### Получение статусов компании

```text
GET /company/statuses/{code}
X-API-Key: <секретный-ключ>
```

Возвращает статусы компании по полям `action_industry` и `action_company`
с человекочитаемыми `title` из связанной таблицы `statuses`.

**Ответы:**

- `200 OK` — статусы компании;
- `400 Bad Request` — невалидный `code`;
- `401 Unauthorized` — неверный или отсутствующий API-ключ;
- `404 Not Found` — компания не найдена;
- `500 Internal Server Error` — ошибка сервера.

**Формат ответа `200 OK`:**

```json
{
  "code": "otus",
  "action_industry": { "code": "in_progress", "title": "В работе" },
  "action_company":  { "code": "backlog",     "title": "В бэклоге" }
}
```

**Пример:**

```bash
curl "http://localhost:8080/company/statuses/otus" \
  -H "X-API-Key: my-secret-key"
```

### Получение статусов статьи

```text
GET /article/statuses/{companyCode}/{articleId}?page=N
X-API-Key: <секретный-ключ>
```

Возвращает статусы статьи из таблицы `articles` по коду компании и id статьи.
Числовой суффикс (`?page=N`) опционален и просто игнорируется — нужен для
совместимости с URL вида `https://habr.com/ru/companies/{code}/articles/{id}/`
(Хабр добавляет номер страницы комментариев).

- `companyCode` — латинские буквы, цифры, `_`, `-`, 1–255 символов;
- `articleId` — положительное целое число.

**Ответы:**

- `200 OK` — статусы статьи;
- `400 Bad Request` — невалидный `companyCode` или `articleId`;
- `401 Unauthorized` — неверный или отсутствующий API-ключ;
- `404 Not Found` — статья не найдена;
- `500 Internal Server Error` — ошибка сервера.

**Формат ответа `200 OK`:**

```json
{
  "id": 1067190,
  "company": "wirenboard",
  "action_dev":      { "code": "in_progress", "title": "В работе" },
  "action_post":     { "code": "done",        "title": "Завершено" },
  "action_comment":  { "code": "backlog",     "title": "В бэклоге" },
  "action_industry": { "code": "unprocessed", "title": "Не обработано" },
  "action_company":  { "code": "rejected",    "title": "Отклонено" }
}
```

`title` каждого статуса подтягивается из связанной таблицы `statuses`.

**Пример:**

```bash
curl "http://localhost:8080/article/statuses/wirenboard/1067190" \
  -H "X-API-Key: my-secret-key"
```

### Получение статусов новости

```text
GET /news/statuses/{companyCode}/{newsId}?page=N
X-API-Key: <секретный-ключ>
```

Возвращает статусы новости из таблицы `news` по коду компании и id новости.
Числовой суффикс (`?page=N`) опционален и просто игнорируется — нужен для
совместимости с URL вида `https://habr.com/ru/companies/{code}/news/{id}/`
(Хабр добавляет номер страницы комментариев).

- `companyCode` — латинские буквы, цифры, `_`, `-`, 1–255 символов;
- `newsId` — положительное целое число.

**Ответы:**

- `200 OK` — статусы новости;
- `400 Bad Request` — невалидный `companyCode` или `newsId`;
- `401 Unauthorized` — неверный или отсутствующий API-ключ;
- `404 Not Found` — новость не найдена;
- `500 Internal Server Error` — ошибка сервера.

**Формат ответа `200 OK`:**

```json
{
  "id": 1067864,
  "company": "infostart",
  "action_dev":      { "code": "in_progress", "title": "В работе" },
  "action_post":     { "code": "done",        "title": "Завершено" },
  "action_comment":  { "code": "backlog",     "title": "В бэклоге" },
  "action_industry": { "code": "unprocessed", "title": "Не обработано" },
  "action_company":  { "code": "rejected",    "title": "Отклонено" }
}
```

`title` каждого статуса подтягивается из связанной таблицы `statuses`.

**Пример:**

```bash
curl "http://localhost:8080/news/statuses/infostart/1067864" \
  -H "X-API-Key: my-secret-key"
```

### Пакетное получение статусов постов

```text
GET /posts/statuses/{companyCode}?ids=1,2,3
X-API-Key: <секретный-ключ>
```

Возвращает статусы сразу нескольких постов из таблицы `posts` одним запросом —
используется Chrome-расширением на странице списка постов компании
(`https://habr.com/ru/companies/{code}/posts/`), чтобы не делать отдельный
запрос на каждый пост.

- `companyCode` — латинские буквы, цифры, `_`, `-`, 1–255 символов;
- `ids` — query-параметр: непустой список id постов через запятую, максимум 100 штук;
  дубликаты и пробелы вокруг значений игнорируются.

**Ответы:**

- `200 OK` — статусы найденных постов (посты, отсутствующие в таблице `posts`,
  просто не включаются в ответ — поэтому `404 Not Found` у этого эндпоинта нет);
- `400 Bad Request` — невалидный `companyCode`, пустой `ids`, невалидный id или
  больше 100 id в запросе;
- `401 Unauthorized` — неверный или отсутствующий API-ключ;
- `500 Internal Server Error` — ошибка сервера.

**Формат ответа `200 OK`:**

```json
{
  "company": "avito",
  "posts": [
    {
      "id": 1026612,
      "company": "avito",
      "action_dev":      { "code": "in_progress", "title": "В работе" },
      "action_post":     { "code": "done",        "title": "Завершено" },
      "action_comment":  { "code": "backlog",     "title": "В бэклоге" },
      "action_industry": { "code": "unprocessed", "title": "Не обработано" },
      "action_company":  { "code": "rejected",    "title": "Отклонено" }
    }
  ]
}
```

`title` каждого статуса подтягивается из связанной таблицы `statuses`.

**Пример:**

```bash
curl "http://localhost:8080/posts/statuses/avito?ids=1026612,1025000" \
  -H "X-API-Key: my-secret-key"
```

### Смена статуса (шаг вперёд / назад)

```text
PATCH /{entity}/statuses/.../{field}/{direction}
X-API-Key: <секретный-ключ>
```

Сдвигает статус на один шаг вперёд или назад по фиксированному порядку:

```
unprocessed → backlog → in_progress → done → rejected
 (Не обработано) (В бэклоге)  (В работе)  (Завершено) (Отклонено)
```

Chrome-расширение вызывает эти эндпоинты при нажатии кнопок «◀ Назад» /
«Вперёд ▶» рядом с бейджами статусов.

**Маршруты по сущностям:**

| Таблица    | Маршрут |
|------------|---------|
| `companies` | `PATCH /company/statuses/{code}/{field}/{direction}` |
| `articles`  | `PATCH /article/statuses/{companyCode}/{articleId}/{field}/{direction}` |
| `news`      | `PATCH /news/statuses/{companyCode}/{newsId}/{field}/{direction}` |
| `posts`     | `PATCH /post/statuses/{companyCode}/{postId}/{field}/{direction}` |

**Параметры пути:**

- `code` / `companyCode` — латинские буквы, цифры, `_`, `-`, 1–255 символов;
- `articleId` / `newsId` / `postId` — положительное целое число;
- `field` — имя action-колонки: `action_dev`, `action_post`, `action_comment`,
  `action_industry`, `action_company`. Для компании (`/company/...`) допустимы
  только `action_industry` и `action_company`;
- `direction` — `fwd` (следующий статус) или `back` (предыдущий).

**Ответы:**

- `200 OK` — статус успешно изменён;
- `400 Bad Request` — невалидные параметры (`code`, `id`, `field`, `direction`);
- `401 Unauthorized` — неверный или отсутствующий API-ключ;
- `404 Not Found` — сущность (компания/статья/новость/пост) не найдена;
- `409 Conflict` — статус уже находится на крайнем значении (шаг невозможен)
  или был изменён параллельно другим запросом;
- `500 Internal Server Error` — ошибка сервера.

**Формат ответа `200 OK`:**

```json
{
  "code": "yandex",
  "field": "action_company",
  "from": { "code": "backlog",     "title": "В бэклоге" },
  "to":   { "code": "in_progress", "title": "В работе" }
}
```

Для контентных сущностей (`article`, `news`, `post`) вместо `code` возвращаются
поля `id` (идентификатор записи) и `company` (код компании).

**Пример:**

```bash
curl -X PATCH \
  "http://localhost:8080/article/statuses/wirenboard/1067190/action_post/fwd" \
  -H "X-API-Key: my-secret-key"
```

## Запуск на Windows

### В GoLand / IntelliJ IDEA

1. Откройте проект `rest-api` как корень.
2. Создайте конфигурацию запуска: **Run → Edit Configurations → Add New → Go Build**.
3. Укажите:
   - **Run kind**: `Directory`
   - **Directory**: `h:\s\Work_habr_companies\rest-api\operate`
   - **Working directory**: `h:\s\Work_habr_companies\rest-api`
   - **Environment**: задайте переменные `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `COMPANY_API_KEY`.
4. Запустите. Сервер будет слушать порт `8080`.

### Из командной строки

```cmd
cd rest-api
set DB_HOST=127.0.0.1:3306
set DB_USER=root
set DB_PASSWORD=
set DB_NAME=habr_companies
set COMPANY_API_KEY=my-secret-key
go run ./operate
```

## Внешний доступ (ngrok)

### Быстрый старт: `scripts/start_all.ps1`

Скрипт делает всё автоматически: поднимает rest-api, настраивает и запускает ngrok-туннель,
проверяет внешний доступ и выводит готовый публичный URL.

**Требования:**
- `rest-api/.env` с заполненными `DB_HOST`, `DB_USER`, `DB_NAME`, `COMPANY_API_KEY` и `NGROK_AUTHTOKEN` (см. [Конфигурация](#конфигурация))
- Если `rest-api.exe` отсутствует — скрипт соберёт его автоматически при наличии Go
- Если ngrok.exe не найден — скрипт скачает его в `%TEMP%\ngrok\`

**Запуск:**
```powershell
cd rest-api
powershell -ExecutionPolicy Bypass -File .\scripts\start_all.ps1
```

С собственным `.env`-файлом:
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start_all.ps1 -EnvFile production.env
```

**Что делает скрипт:**
1. Читает `.env`, валидирует обязательные переменные
2. Находит или скачивает ngrok, настраивает authtoken
3. Останавливает предыдущие процессы rest-api / ngrok на порту 8080
4. Запускает `rest-api.exe` (сборка через `go build`, если бинарник отсутствует)
5. Ждёт готовности сервера (TCP-проверка порта 8080)
6. Запускает `ngrok http 8080`
7. Получает публичный HTTPS-URL через ngrok API (`localhost:4040`)
8. Делает тестовый POST-запрос и выводит результат
9. Печатает сводку: локальный адрес, публичный URL, API-ключ, пример curl

**Выход:** Ctrl+C в окне скрипта останавливает оба процесса.

### Ручной запуск ngrok

Если скрипт не используется, туннель можно поднять вручную:

1. Запустите сервис локально (порт `8080`).
2. В отдельном терминале:
   ```cmd
   ngrok http 8080
   ```
3. Используйте HTTPS-URL из вывода ngrok.

### Использование в Chrome-расширении

**Конфигурация для расширения:**
- **Базовый URL**: `https://xxxx-xx-xxx.ngrok-free.dev` (из вывода скрипта или ngrok)
- **Endpoint**: `POST /company/add/{code}/{title}`
- **Заголовок аутентификации**: `X-API-Key: <ваш-секретный-ключ-из-.env>`

**Веб-интерфейс ngrok:** http://localhost:4040 (просмотр трафика и логов)

## Тестирование

```bash
# модульные тесты (БД не требуется)
go test ./...

# интеграционные тесты (требуют MySQL)
go test -tags=integration ./...
```

## Автозагрузка при старте Windows

Для запуска rest-api + ngrok при старте Windows используется `scripts/start_all.ps1`.
Варианты ниже подходят для этого скрипта. Ни один из них не требует прав администратора.

> **Нюансы:** пути в автозагрузке абсолютные — не переносите проект в другую папку после настройки.
> Скрипт сам находит `.env`, собирает `rest-api.exe` (если бинарника нет) и скачивает ngrok —
> дополнительная подготовка не нужна. При старте он останавливает предыдущие процессы rest-api/ngrok,
> поэтому конфликтов портов не бывает.

### Вариант 1 — Папка автозагрузки (проще всего)

Запуск при входе в систему текущего пользователя.

1. Нажмите `Win+R`, введите `shell:startup` и нажмите Enter.
2. Создайте в открывшейся папке файл `start_all.bat` с содержимым:
   ```bat
   @echo off
   start "" /MIN powershell -NoProfile -ExecutionPolicy Bypass -File "H:\s\Work_habr_companies\rest-api\scripts\start_all.ps1"
   ```
   В Блокноте: «Сохранить как» → тип файла «Все файлы».
3. Готово. При входе в Windows скрипт запустится свёрнутым. Окно PowerShell остаётся открытым —
   это нормально, цикл keep-alive скрипта держит сервисы.

### Вариант 2 — Планировщик задач (рекомендуется)

Позволяет запускать сервис даже без входа пользователя в систему (при включении ПК).

1. Нажмите `Win+R`, введите `taskschd.msc` и нажмите Enter.
2. В правой панели выберите «Создать задачу…».
3. Вкладка **Общие**: имя `HabrCompanies`, отметьте «Выполнять с наивысшими правами».
4. Вкладка **Триггеры** → «Создать…»: выберите «При запуске компьютера»
   (или «При входе в систему», если сервис нужен только залогиненному пользователю).
5. Вкладка **Действия** → «Создать…»: программа `powershell`, аргументы:
   ```
   -NoProfile -ExecutionPolicy Bypass -File "H:\s\Work_habr_companies\rest-api\scripts\start_all.ps1"
   ```
6. Вкладка **Условия**: для стационарного ПК снимите «Запускать только при питании от электросети».
7. Нажмите **OK**. Если выбраны «При запуске компьютера» и «Выполнять независимо от регистрации
   пользователя» — Windows запросит пароль учётной записи.

### Вариант 3 — Реестр (одна команда)

Запуск при входе в систему текущего пользователя.

Добавить в автозагрузку:
```powershell
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v HabrCompanies /t REG_SZ /d "powershell -NoProfile -ExecutionPolicy Bypass -File \"H:\s\Work_habr_companies\rest-api\scripts\start_all.ps1\"" /f
```

Удалить из автозагрузки:
```powershell
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v HabrCompanies /f
```

### Проверка после перезагрузки

- Сервер доступен локально:
  ```cmd
  curl http://localhost:8080
  ```
- Веб-интерфейс ngrok открывается в браузере по адресу http://localhost:4040.
- Свежая запись в логе туннеля: `%TEMP%\ngrok_startall.log`.
- HTTPS-URL из вывода ngrok можно использовать в Chrome-расширении.

### Прочие скрипты

| Скрипт | Назначение |
|--------|-----------|
| `scripts/start_all.ps1` | Запускает rest-api + ngrok одной командой (см. [Внешний доступ](#внешний-доступ-ngrok)) |

## База данных

Таблица `companies` создаётся вручную (см. `sql/create_companies_table.sql`):

```sql
CREATE TABLE companies (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    last_processed_article_id BIGINT UNSIGNED NULL DEFAULT NULL
);
```

Колонка `last_processed_article_id` хранит прогресс обхода краулера
(последний обработанный `article_id` по каждой компании). Для
существующих баз её можно добавить скриптом
`sql/add_last_processed_article_id_to_companies.sql` (или вручную:
`ALTER TABLE companies ADD COLUMN last_processed_article_id BIGINT UNSIGNED NULL DEFAULT NULL;`).
Rest-api эта колонка не трогает — она используется только краулером.

### Статусы компаний

Справочник `statuses` и колонки `action_industry` / `action_company` в таблице
`companies` создаются идемпотентной миграцией `sql/create_statuses_and_action_columns.sql`:

```sql
CREATE TABLE statuses (
    code  VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);
-- companies: action_industry, action_company → FK на statuses(code)
```

Возможные значения: `unprocessed` (Не обработано), `backlog` (В бэклоге),
`in_progress` (В работе), `done` (Завершено), `rejected` (Отклонено).

Эндпоинт `GET /company/statuses/{code}` возвращает эти статусы вместе с
человекочитаемыми `title` из справочника (см. [API](#получение-статусов-компании)).

### Статусы статей

Таблица `articles` содержит колонки `action_dev`, `action_post`,
`action_comment`, `action_industry`, `action_company` — FK на тот же справочник
`statuses` (миграция `sql/create_statuses_and_action_columns.sql`). Эндпоинт
`GET /article/statuses/{companyCode}/{articleId}` возвращает их вместе с
человекочитаемыми `title` (см. [API](#получение-статусов-статьи)).

### Статусы постов

Таблица `posts` содержит ту же пятёрку action-колонок (`action_dev`,
`action_post`, `action_comment`, `action_industry`, `action_company`) — FK на
справочник `statuses`. Пакетный эндпоинт `GET /posts/statuses/{companyCode}?ids=...`
возвращает статусы сразу нескольких постов одним запросом (см.
[API](#пакетное-получение-статусов-постов)).

### Порядок статусов и их смена

Все статусы упорядочены фиксированной цепочкой:

```
unprocessed → backlog → in_progress → done → rejected
```

Эндпоинты `PATCH /{entity}/statuses/.../{field}/{direction}` (см.
[API](#смена-статуса-шаг-вперёд--назад)) сдвигают значение action-колонки на один
шаг вперёд (`fwd`) или назад (`back`) по этой цепочке.

Смена выполняется в две операции внутри одного соединения:

1. Чтение текущего кода статуса из соответствующей таблицы;
2. Атомарное обновление с условием `... AND {field} = '<старый-код>'` — если за
   время между чтением и записью кто-то другой уже изменил статус, запрос вернёт
   `409 Conflict`, а клиент (Chrome-расширение) перезапросит актуальные статусы.

Если статус уже находится на краю цепочки (`unprocessed` при шаге назад или
`rejected` при шаге вперёд), также возвращается `409 Conflict`.
