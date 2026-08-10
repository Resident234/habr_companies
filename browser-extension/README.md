# Habr Companies — расширение для браузера

Браузерное расширение для Chrome и Firefox (Manifest V3), которое извлекает информацию о компаниях со страниц habr.com и отправляет её в настроенный сервис.

## Функциональность

- **Экстракция данных компании** со страниц, подходящих под паттерн `https://habr.com/ru/companies/*`:
  - **Код компании** — извлекается из URL (например, `selectel` из `/ru/companies/selectel/`)
  - **Название компании** — извлекается из DOM элемента `.tm-company-profile-card .info a.name span`
- **Отправка данных в сервис** — POST-запрос на `{base_url}/company/add/{code}/{title}` с заголовком `X-API-Key`
- **Отображение ответа** — ответ сервиса выводится во всплывающем сообщении на странице через `MessageControl`
- **Индикаторы статусов компании** — после отправки данных запрашиваются статусы (`GET {base_url}/company/statuses/{code}`) и рядом с названием компании выводятся цветные бейджи со значениями `action_industry` и `action_company` (человекочитаемые `title` из справочника `statuses`)
- **Индикаторы статусов статьи** — на детальной странице статьи (`https://habr.com/ru/companies/{code}/articles/{id}/`) запрашиваются статусы (`GET {base_url}/article/statuses/{code}/{id}`) и под заголовком статьи (`h1.tm-title`) выводятся цветные бейджи со значениями `action_dev`, `action_post`, `action_comment`, `action_industry` и `action_company` (человекочитаемые `title` из справочника `statuses`; tooltip бейджа уточняет название поля: «Разработка», «Пост», «Комментарий», «Отрасль», «Компания»)
- **Настройка адреса сервиса** — URL сервиса можно изменить на странице настроек расширения
- **Автоматический запуск** — запрос отправляется после полной загрузки страницы

## Архитектура

Логика расширения разделена на три класса, каждый из которых отвечает за свою зону ответственности:

| Класс | Файл | Ответственность |
|---|---|---|
| `CompanyExtractor` | `content_scripts/companyExtractor.js` | Извлечение данных из URL и DOM: извлечение кода компании из URL (`extractCode`), извлечение названия компании из DOM (`extractTitle`). Все методы статические — не зависит от браузерного storage и не выполняет сетевых запросов. |
| `CompanyApiClient` | `content_scripts/companyApiClient.js` | Работа с REST API: `sendCompany(code, title)` — POST-запрос добавления компании; `getStatuses(code)` — GET-запрос статусов компании; `getArticleStatuses(companyCode, articleId)` — GET-запрос статусов статьи. Base URL читается из настроек (`BrowserStorage`). |
| `CompanyProcessor` | `content_scripts/companyProcessor.js` | Оркестратор (точка входа): ждёт загрузки страницы, проверяет корректность URL, затем выбирает сценарий по типу страницы. Страница компании (`_initCompanyPage`): извлекает данные через `CompanyExtractor`, отправляет их через `CompanyApiClient.sendCompany()`, показывает результат через `MessageControl`, запрашивает статусы через `getStatuses()` и выводит их через `StatusBadges.render()`. Детальная страница статьи (`_initArticlePage`): извлекает `code` компании и `id` статьи из URL (`/ru/companies/{code}/articles/{id}/`), запрашивает статусы через `getArticleStatuses()` и выводит их через `StatusBadges.renderArticle()` возле заголовка статьи. |
| `StatusBadges` | `content_scripts/statusBadges.js` | Отображение индикаторов статусов: `render(statuses)` — после ссылки с названием компании (`.info a.name`) бейджи `action_industry` и `action_company`; `renderArticle(statuses)` — под заголовком статьи (`h1.tm-title`) бейджи `action_dev`, `action_post`, `action_comment`, `action_industry`, `action_company`. Цвет бейджа зависит от кода статуса. |

### Поток данных

```
CompanyProcessor (оркестратор)
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
    └── Детальная страница статьи: /ru/companies/{code}/articles/{id}/
            │
            ├── CompanyApiClient.getArticleStatuses(code, id)
            │       → { action_dev, action_post, action_comment, action_industry, action_company }
            │
            └── StatusBadges.renderArticle(statuses) → бейджи под заголовком статьи
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
│   ├── statusBadges.js                          # Индикаторы статусов: компании рядом с названием, статьи под заголовком
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
```

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
