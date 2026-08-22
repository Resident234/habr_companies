# Habr Companies — расширение для браузера

Браузерное расширение для Chrome и Firefox (Manifest V3), которое извлекает информацию о компаниях со страниц habr.com и отправляет её в настроенный сервис.

## Функциональность

- **Экстракция данных компании** со страниц, подходящих под паттерн `https://habr.com/ru/companies/*`:
  - **Код компании** — извлекается из URL (например, `selectel` из `/ru/companies/selectel/`)
  - **Название компании** — извлекается из DOM элемента `.tm-company-profile-card .info a.name span`
- **Отправка данных в сервис** — POST-запрос на `{base_url}/company/add/{code}/{title}` с заголовком `X-API-Key`
- **Отображение ответа** — ответ сервиса выводится во всплывающем сообщении на странице через `MessageControl`
- **Индикаторы статусов компании** — после отправки данных запрашиваются статусы (`GET {base_url}/company/statuses/{code}`) и рядом с названием компании выводятся цветные бейджи со значениями `action_industry` и `action_company` (человекочитаемые `title` из справочника `statuses`)
- **Совместимость с бесплатным ngrok** — все запросы к REST API проходят через фоновый обработчик и автоматически получают заголовок `ngrok-skip-browser-warning: true`. Он отключает HTML interstitial-страницу бесплатного ngrok, чтобы вместо неё расширение получало JSON-ответ API; без этого статусы не разбираются и бейджи не отображаются.

- **Индикаторы статусов статьи** — на детальной странице статьи (`https://habr.com/ru/companies/{code}/articles/{id}/`) запрашиваются статусы (`GET {base_url}/article/statuses/{code}/{id}`) и под заголовком статьи (`h1.tm-title`) выводятся цветные бейджи со значениями `action_dev`, `action_post`, `action_comment`, `action_industry` и `action_company` (человекочитаемые `title` из справочника `statuses`; tooltip бейджа уточняет название поля: «Разработка», «Пост», «Комментарий», «Отрасль», «Компания»)
- **Индикаторы статусов новости** — на детальной странице новости (`https://habr.com/ru/companies/{code}/news/{id}/`) запрашиваются статусы (`GET {base_url}/news/statuses/{code}/{id}`) и под заголовком новости (`h1.tm-title`) выводятся те же цветные бейджи с пятью action-полями
- **Индикаторы статусов в списке постов** — на странице списка постов компании (`https://habr.com/ru/companies/{code}/posts/`, включая страницы пагинации `.../posts/page{N}/`) id постов собираются из атрибутов `id` тегов `article` внутри `.tm-articles-list`, статусы запрашиваются одним пакетным запросом (`GET {base_url}/posts/statuses/{code}?ids=...`, до 100 id за раз) и бейджи с пятью action-полями выводятся после заголовка каждого поста в списке (`StatusBadges.renderPostInList`)
- **Индикаторы статусов на детальной странице поста** — на странице поста (`https://habr.com/ru/companies/{code}/posts/{id}/`) статусы запрашиваются тем же пакетным эндпоинтом (`GET {base_url}/posts/statuses/{code}?ids={id}`) и бейджи с пятью action-полями выводятся инлайн рядом с заголовком внутри `.article-formatted-body` (после `<strong>` первого параграфа; если он не найден — после `h1.tm-title`) через `StatusBadges.renderPost`
- **Смена статусов прямо со страницы** — рядом с каждым бейджем (на всех типах страниц) выводятся кнопки «◀ Назад» и «Вперёд ▶». При нажатии расширение вызывает PATCH-эндпоинт `PATCH {base_url}/{entity}/statuses/.../{field}/{direction}`, который сдвигает статус на один шаг по фиксированному порядку `unprocessed → backlog → in_progress → done → rejected`; после успешного ответа цвет и текст бейджа обновляются без перезагрузки страницы. При ответе `409 Conflict` (статус изменился параллельно) расширение перезапрашивает актуальные статусы и обновляет бейдж
- **Настройка адреса сервиса** — URL сервиса можно изменить на странице настроек расширения
- **Настройка длительности отображения сообщений** — время показа зелёного бара «Компания успешно добавлена…» (и других сообщений `MessageControl`) настраивается на странице настроек расширения в секундах (по умолчанию 120, хранится в `BrowserStorage` как `message_display_duration`; при недоступности настроек используется значение `CONFIG.MESSAGE_DISPLAY_DURATION`)
- **Синхронизация закладок комментариев** — при клике на значок закладки комментария (★) на страницах постов, статей или новостей компаний расширение автоматически добавляет или удаляет комментарий в закладки через REST API (POST /comment/add или DELETE /comment/{id}). Полный текст комментария извлекается из DOM без ограничения в 500 символов, включая актуальный AJAX-контейнер Habr `.tm-comment__body-content` (с fallback на `.comment-body`, `.comment-content`, `.message` и `.tm-comment__body`). После клика расширение несколько раз повторяет поиск текста, чтобы дождаться завершения AJAX-загрузки; идентификатор сущности и её ID определяются из URL страницы или мета-тега `og:url`. Для статьи дополнительно передаются `company_code` из URL и `article_title` из `h1.tm-title` (fallback — первый `h1`); сервер использует их для создания отсутствующей записи статьи до сохранения комментария. Если заголовок отсутствует, пустой или не читается из DOM, расширение записывает диагностическую ошибку, показывает сообщение «Не удалось определить заголовок статьи на странице Habr» и не отправляет неполный запрос. Если после ожидания AJAX текст комментария так и не найден, расширение записывает диагностическую ошибку, показывает сообщение «Не удалось определить текст комментария на странице Habr» и также не отправляет запрос. Перед отправкой комментария расширение записывает в консоль тип и ID сущности, ID комментария, код компании и признак наличия `article_title` (сам текст комментария и секретный ключ не логируются). Если REST API отклоняет запрос с `4xx/5xx`, пользователю показывается HTTP-статус и текст ошибки из JSON-ответа, а подробности ответа записываются в консоль.
- **Автоматический запуск** — запрос отправляется после полной загрузки страницы. Если сервис недоступен или возвращает не-JSON, бейджи не добавляются; в таком случае нужно проверить API Service URL в настройках расширения и состояние REST API/ngrok. Также бейджи не выводятся для статей, постов и новостей, которых ещё нет в базе данных сервиса (API возвращает `404 Not Found`).

- **Быстрое добавление компании/отрасли через выделение текста** — на страницах Habr компаний (`https://habr.com/ru/companies/*`) при выделении текста появляется плавающая панель с кнопками для сохранения выделенного текста как компании (`POST /company/quick-add`) или отрасли (`POST /category/quick-add`). Сервер автоматически транслитерирует название в код (например, "Яндекс" → "Yandeks"). Панель показывает визуальную обратную связь (зелёный — успех, красный — ошибка); на других страницах панель не инициализируется. Панель закрепляется относительно окна браузера и располагается на расстоянии 6 px от выделения, а если сверху недостаточно места — под выделением.

## Архитектура

Логика расширения разделена на три класса, каждый из которых отвечает за свою зону ответственности:

| Класс | Файл | Ответственность |
|---|---|---|
| `CompanyExtractor` | `content_scripts/companyExtractor.js` | Извлечение данных из URL и DOM: извлечение кода компании из URL (`extractCode`), извлечение названия компании из DOM (`extractTitle`). Все методы статические — не зависит от браузерного storage и не выполняет сетевых запросов. |
| `CompanyApiClient` | `content_scripts/companyApiClient.js` | Работа с REST API: `sendCompany(code, title)` — POST-запрос добавления компании; `getStatuses(code)` — GET-запрос статусов компании; `getArticleStatuses(companyCode, articleId)` — GET-запрос статусов статьи; `getNewsStatuses(companyCode, newsId)` — GET-запрос статусов новости; `getPostsStatuses(companyCode, postIds)` — пакетный GET-запрос статусов постов (`?ids=...`); `updateCompanyStatus(code, field, direction)` / `updateArticleStatus(code, id, field, direction)` / `updateNewsStatus(code, id, field, direction)` / `updatePostStatus(code, id, field, direction)` — PATCH-запросы смены статуса на шаг вперёд (`fwd`) или назад (`back`); `addComment(data)` / `deleteComment(commentId)` — добавление/удаление закладки комментария. Для `addComment` на статье `data` также содержит `company_code` и `article_title`, чтобы REST API зарегистрировал статью перед сохранением. Base URL читается из настроек (`BrowserStorage`). |
| `CommentBookmarkWatcher` | `content_scripts/commentBookmarkWatcher.js` | Отслеживает клики на закладки комментариев (★) на всех страницах с комментариями через делегирование событий на `document`. Валидирует, что клик был на кнопке закладки комментария (`.bookmarks-button.footer-button.footer-button--with-icon` внутри `[data-comment-body]`), извлекает полный текст комментария из AJAX-контейнера `.tm-comment__body-content` или fallback-селекторов, при необходимости ожидая его появления, определяет сущность, её ID и код компании из URL или `og:url`, затем вызывает `CompanyApiClient.addComment()` или `deleteComment()` в зависимости от состояния закладки. Для статей также извлекает заголовок из `h1.tm-title`/первого `h1` и передаёт `company_code` и `article_title`. При ошибке или отсутствии заголовка запрос не отправляется: ошибка логируется, а пользователю показывается понятное сообщение. Использует `WeakSet` для предотвращения двойной обработки. |
| `CompanyProcessor` | `content_scripts/companyProcessor.js` | Оркестратор (точка входа): инициализирует `CommentBookmarkWatcher` на всех страницах (в т.ч. на страницах комментариев), затем проверяет корректность URL и выбирает сценарий по типу страницы. Страница компании (`_initCompanyPage`): извлекает данные через `CompanyExtractor`, отправляет их через `CompanyApiClient.sendCompany()`, показывает результат через `MessageControl`, запрашивает статусы через `getStatuses()` и выводит их через `StatusBadges.render()`. Детальная страница статьи (`_initArticlePage`): извлекает `code` компании и `id` статьи из URL (`/ru/companies/{code}/articles/{id}/`), запрашивает статусы через `getArticleStatuses()` и выводит их через `StatusBadges.renderArticle()` возле заголовка статьи. Детальная страница новости (`_initNewsPage`): извлекает `code` компании и `id` новости из URL (`/ru/companies/{code}/news/{id}/`), запрашивает статусы через `getNewsStatuses()` и выводит их через `StatusBadges.renderNews()` возле заголовка новости. Страница списка постов (`_initPostsListPage`): извлекает `code` компании из URL (`/ru/companies/{code}/posts/` или `.../posts/page{N}/`), собирает id постов из DOM (`.tm-articles-list article[id]`), запрашивает статусы одним вызовом `getPostsStatuses()` и выводит бейджи рядом с заголовком каждого найденного поста через `StatusBadges.renderPostInList()`. Детальная страница поста (`_initPostPage`): извлекает `code` компании и `id` поста из URL (`/ru/companies/{code}/posts/{id}/`), запрашивает статусы через `getPostsStatuses(code, [id])` и выводит их инлайн рядом с заголовком поста через `StatusBadges.renderPost()`. |
| `StatusBadges` | `content_scripts/statusBadges.js` | Отображение и редактирование индикаторов статусов: `render(statuses)` — после ссылки с названием компании (`.info a.name`) бейджи `action_industry` и `action_company`; `renderArticle(statuses)` / `renderNews(statuses)` — под заголовком статьи или новости (`h1.tm-title`) бейджи `action_dev`, `action_post`, `action_comment`, `action_industry`, `action_company`; `renderPostInList(articleElement, statuses)` — те же пять бейджей после заголовка поста в списке постов; `renderPost(statuses)` — те же пять бейджей инлайн после заголовка на детальной странице поста (`.article-formatted-body p strong`, fallback — `h1.tm-title`). Цвет бейджа зависит от кода статуса. Каждый бейдж содержит кнопки «◀»/«▶» и data-атрибуты (`entity`, `field`, `company`, `id`); по клику вызывается PATCH-эндпоинт смены статуса (см. `CompanyApiClient.updateXStatus`), после успеха бейдж обновляется (`_applyStatus`), при конфликте `409` статус перезапрашивается (`_refreshStatuses`). |

### Поток данных

```
CompanyProcessor (оркестратор)
    │
    ├── Все страницы с комментариями
    │       │
    │       └── CommentBookmarkWatcher.init() — делегирование кликов на document
    │           └── При клике на ★: addComment() / deleteComment() через CompanyApiClient
    │
    ├── Страница компании: /ru/companies/{code}/
    │       │
    │       ├── CompanyExtractor (статические методы) → { code, title }
    │       │
    │       ├── CompanyApiClient.sendCompany(code, title) → responseText
    │       │       │
    │       │       └── BrowserStorage (base URL из настроек)
    │       │
    │       ├── CompanyApiClient.getStatuses(code) → { action_industry, action_company }
    │       │
    │       └── StatusBadges.render(statuses) → бейджи рядом с названием компании
    │
    ├── Детальная страница статьи: /ru/companies/{code}/articles/{id}/
    │       │
    │       ├── CompanyApiClient.getArticleStatuses(code, id)
    │       │       → { action_dev, action_post, action_comment, action_industry, action_company }
    │       │
    │       └── StatusBadges.renderArticle(statuses) → бейджи под заголовком статьи
    │
    ├── Детальная страница новости: /ru/companies/{code}/news/{id}/
    │       │
    │       ├── CompanyApiClient.getNewsStatuses(code, id)
    │       │       → { action_dev, action_post, action_comment, action_industry, action_company }
    │       │
    │       └── StatusBadges.renderNews(statuses) → бейджи под заголовком новости
    │
    └── Страница списка постов: /ru/companies/{code}/posts/ (и /posts/page{N}/)
            │
            ├── DOM: .tm-articles-list article[id] → [id1, id2, ...]
            │
            ├── CompanyApiClient.getPostsStatuses(code, ids) — один запрос
            │       → { company, posts: [{ id, action_dev, ... }] }
            │
            └── StatusBadges.renderPostInList(article, statuses)
                    → бейджи после заголовка каждого найденного поста
```

### Цвета бейджей статусов

| Статус (`code`) | Значение (`title`) | Цвет бейджа |
|---|---|---|
| `unprocessed` | Не обработано | серый |
| `backlog` | В бэклоге | синий |
| `in_progress` | В работе | оранжевый |
| `done` | Завершено | зелёный |
| `rejected` | Отклонено | красный |

## Конфигурация

Параметры задаются в файле `config.js`:

```js
export const CONFIG = {
    API_KEY: 'YOUR_COMPANY_API_KEY_HERE',        // Ключ API для доступа к сервису
    DEFAULT_BASE_URL: 'https://...',             // URL сервиса по умолчанию
    URL_PATTERN: 'https://habr.com/ru/companies/*',  // Паттерн для срабатывания
};
```

> **Примечание:** `API_KEY` и `URL_PATTERN` задаются жёстко в коде плагина.  
> `base_url` можно менять через страницу настроек расширения (хранится в `storage.local`).

## Структура проекта

```
browser-extension/
├── config.js                                    # Глобальные константы
├── manifest.json                                # Манифест расширения (v3)
├── content_scripts/
│   ├── index.js                                 # Точка входа content-скрипта
│   ├── companyProcessor.js                      # Оркестратор (проверка страницы → извлечение → отправка → показ)
│   ├── companyExtractor.js                      # Извлечение данных из URL и DOM
│   ├── companyApiClient.js                      # Работа с REST API (добавление компании, получение статусов)
│   ├── statusBadges.js                          # Индикаторы статусов: компании рядом с названием, статьи/новости под заголовком, посты в списке
│   ├── textSelectionPanel.js                    # Панель быстрых действий по выделению текста только на страницах Habr компаний

│   ├── browserAPI.js                            # Обёртка над browser API
│   ├── browserStorage.js                        # Работа с chrome.storage.local
│   └── messageControl.js                        # Всплывающие сообщения
├── background_scripts/
│   ├── menuInitialisation.js                    # Фоновый скрипт (заглушка)
│   └── preferencesInitialisation.js             # Инициализация страницы настроек
├── components/
│   ├── preferences.js                           # Логика страницы настроек
│   └── popup.js                                 # Логика всплывающего окна
├── views/
│   ├── preferences.html                         # Страница настроек
│   └── popup.html                               # Всплывающее окно
├── postman/
│   └── companies-api.postman_collection.json    # Postman-коллекция API
├── _locales/
│   ├── en/                                      # Английская локализация
│   └── ru/                                      # Русская локализация
├── icons/                                       # Иконки расширения
└── content/                                     # CSS-стили
```

## Установка

### Локальная установка (для разработки)

#### В Chrome:
1. Откройте Chrome и в адресной строке введите:
   ```
   chrome://extensions/
   ```
2. **Включите режим разработчика** — переключатель в правом верхнем углу страницы.
3. **Нажмите "Загрузить распакованное"** (Load unpacked) и выберите папку:
   ```
   browser-extension
   ```
4. **Готово** — расширение **"Habr Companies"** появится в списке и будет доступно через иконку в панели расширений Chrome.

#### В Firefox:
1. Откройте `about:debugging#/runtime/this-firefox`
2. Включите **Режим разработчика**
3. Нажмите **"Временное дополнение"** (Load Temporary Add-on)
4. Выберите файл `manifest.json` из папки `browser-extension`

> **Примечание:** Если вносите изменения в код расширения, на странице `chrome://extensions/` нажмите **"Перезагрузить"** (Reload) рядом с расширением, чтобы применить изменения.

### Настройка после установки

1. Нажмите на иконку расширения на панели браузера
2. Выберите **Settings**
3. Укажите **API Service URL** (если необходимо изменить значение по умолчанию)
4. Нажмите **Save**

## Разработка

### Зависимости

- [Node.js](https://nodejs.org/)
- npm

### Команды

```bash
npm test           # Запуск тестов (mocha)
npm run lint       # Проверка кода ESLint
```

### Используемые технологии

- **Manifest V3** — современная версия манифеста расширений
- **ES6 Modules** — модульная архитектура
- **Babel** — транспиляция для совместимости
- **ESLint** — линтинг кода

## Тестирование

Тесты находятся в директории `tests/`. Запуск:

```bash
npm test
```

## API сервиса

Описание эндпоинтов и примеры запросов доступны в Postman-коллекции:

```
postman/companies-api.postman_collection.json
```

### Формат запроса

```
POST {base_url}/company/add/{code}/{title}
X-API-Key: {api_key}
ngrok-skip-browser-warning: true  # добавляется расширением автоматически
```

Заголовок `ngrok-skip-browser-warning` добавляется ко всем запросам `CompanyApiClient`, включая GET статусов, PATCH смены статусов и операции с закладками комментариев, а также к запросам панели быстрого добавления по выделению текста.

### Пример

```
POST https://example.com/company/add/selectel/Selectel
X-API-Key: your-api-key-here
```

### Получение статусов компании

```
GET {base_url}/company/statuses/{code}
X-API-Key: {api_key}
```

Ответ `200 OK`:

```json
{
  "code": "otus",
  "action_industry": { "code": "in_progress", "title": "В работе" },
  "action_company":  { "code": "backlog",     "title": "В бэклоге" }
}
```

Значения `title` выводятся в бейджах рядом с названием компании на странице профиля.

### Получение статусов статьи

```
GET {base_url}/article/statuses/{companyCode}/{articleId}
X-API-Key: {api_key}
```

Ответ `200 OK`:

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

Значения `title` выводятся в бейджах под заголовком статьи (`h1.tm-title`) на
детальной странице `https://habr.com/ru/companies/{code}/articles/{id}/`.
Порядок бейджей: `action_dev` (Разработка), `action_post` (Пост),
`action_comment` (Комментарий), `action_industry` (Отрасль), `action_company`
(Компания); название поля также видно в tooltip бейджа.

### Получение статусов новости

```
GET {base_url}/news/statuses/{companyCode}/{newsId}
X-API-Key: {api_key}
```

Ответ `200 OK`:

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

Значения `title` выводятся в бейджах под заголовком новости (`h1.tm-title`) на
детальной странице `https://habr.com/ru/companies/{code}/news/{id}/` — стиль и
порядок бейджей такие же, как у статьи.

### Пакетное получение статусов постов

```
GET {base_url}/posts/statuses/{companyCode}?ids=1,2,3
X-API-Key: {api_key}
```

Используется на странице списка постов компании
(`https://habr.com/ru/companies/{code}/posts/`, включая `.../posts/page{N}/`): id
постов собираются из атрибутов `id` тегов `article` внутри `.tm-articles-list`,
и статусы всех постов страницы запрашиваются одним запросом (максимум 100 id за
раз; дубликаты в `ids` игнорируются).

Ответ `200 OK` (включает только посты, найденные в базе):

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

Значения `title` выводятся в бейджах после заголовка каждого поста в списке
(`StatusBadges.renderPostInList`). Посты, не найденные в базе, просто не получают
бейджей.

### Смена статуса (шаг вперёд / назад)

Вызывается при нажатии кнопок «◀ Назад» / «Вперёд ▶» рядом с бейджем статуса.
Сдвигает статус на один шаг по фиксированному порядку:

```
unprocessed → backlog → in_progress → done → rejected
 (Не обработано) (В бэклоге)   (В работе)   (Завершено) (Отклонено)
```

```
PATCH {base_url}/{entity}/statuses/.../{field}/{direction}
X-API-Key: {api_key}
```

| Сущность | Запрос |
|---|---|
| Компания | `PATCH /company/statuses/{code}/{field}/{direction}` |
| Статья | `PATCH /article/statuses/{companyCode}/{articleId}/{field}/{direction}` |
| Новость | `PATCH /news/statuses/{companyCode}/{newsId}/{field}/{direction}` |
| Пост | `PATCH /post/statuses/{companyCode}/{postId}/{field}/{direction}` |

- `field` — имя action-поля: `action_dev`, `action_post`, `action_comment`,
  `action_industry`, `action_company`. Для компании допустимы только
  `action_industry` и `action_company`;
- `direction` — `fwd` (следующий статус) или `back` (предыдущий).

**Ответы:** `200 OK` — статус сменился (тело содержит прежнее `from` и новое `to`
значения); `400` — невалидные параметры; `401` — неверный API-ключ; `404` —
запись не найдена; `409` — статус изменился параллельно или шаг невозможен
(уже первый/последний статус); `500` — ошибка сервера.

Ответ `200 OK` (для статьи; у компании вместо `id`/`company` возвращается `code`):

```json
{
  "id": 1067190,
  "company": "wirenboard",
  "field": "action_post",
  "from": { "code": "in_progress", "title": "В работе" },
  "to":   { "code": "done",        "title": "Завершено" }
}
```

## Быстрое добавление компании/отрасли через выделение текста

Новая функция: при выделении текста на любой странице появляется плавающая панель с двумя кнопками:

- **🏢 Компания** — сохраняет выделенный текст как название компании в таблицу `companies`
- **📂 Отрасль** — сохраняет выделенный текст как название отрасли в таблицу `category`

### Как работает

1. Пользователь выделяет текст на странице (например, "Яндекс" или "Финтех")
2. Появляется плавающая панель с двумя кнопками
3. При нажатии на кнопку выделенный текст отправляется на соответствующий эндпоинт:
   - `POST /company/quick-add` — для компании
   - `POST /category/quick-add` — для отрасли
4. Сервер автоматически транслитерирует название в код (например, "Яндекс" → "Yandeks")
5. Панель показывает визуальную обратную связь (зелёный — успех, красный — ошибка)

### API эндпоинты

```
POST {base_url}/company/quick-add
X-API-Key: {api_key}
Content-Type: application/json

{
  "title": "Яндекс"
}
```

Ответ `201 Created` (новая запись) или `200 OK` (обновлена существующая):

```json
{
  "code": "Yandeks",
  "title": "Яндекс"
}
```

Аналогично для отрасли:

```
POST {base_url}/category/quick-add
X-API-Key: {api_key}
Content-Type: application/json

{
  "title": "Финтех"
}
```

### Транслитерация

Сервер автоматически конвертирует кириллицу в латиницу:

- "Яндекс" → "Yandeks"
- "Сбербанк" → "Sberbank"
- "Тинькофф" → "Tinkoff"
- "1С" → "1S"
- "Hello World" → "Hello_World"

### Ограничения

- Панель появляется только для выделения 1-200 символов без переносов строк
- Текст автоматически обрезается и нормализуется
- Поддерживаются русские и английские символы, цифры, дефисы и подчёркивания

### Реализация

- **Backend**: `rest-api/util/transliterate.go`, `dbOp/db.go` (UpsertCategory), `route/route.go` (новые эндпоинты)
- **Frontend**: `browser-extension/content_scripts/textSelectionPanel.js` (плавающая панель)
- **Интеграция**: `browser-extension/content_scripts/index.js` (инициализация панели)


