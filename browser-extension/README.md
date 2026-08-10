# Habr Companies — расширение для браузера

Браузерное расширение для Chrome и Firefox (Manifest V3), которое извлекает информацию о компаниях со страниц habr.com и отправляет её в настроенный сервис.

## Функциональность

- **Экстракция данных компании** со страниц, подходящих под паттерн `https://habr.com/ru/companies/*`:
  - **Код компании** — извлекается из URL (например, `selectel` из `/ru/companies/selectel/`)
  - **Название компании** — извлекается из DOM элемента `.tm-company-profile-card .info a.name span`
- **Отправка данных в сервис** — POST-запрос на `{base_url}/company/add/{code}/{title}` с заголовком `X-API-Key`
- **Отображение ответа** — ответ сервиса выводится во всплывающем сообщении на странице через `MessageControl`
- **Индикаторы статусов компании** — после отправки данных запрашиваются статусы (`GET {base_url}/company/statuses/{code}`) и рядом с названием компании выводятся цветные бейджи со значениями `action_industry` и `action_company` (человекочитаемые `title` из справочника `statuses`)
- **Настройка адреса сервиса** — URL сервиса можно изменить на странице настроек расширения
- **Автоматический запуск** — запрос отправляется после полной загрузки страницы

## Архитектура

Логика расширения разделена на три класса, каждый из которых отвечает за свою зону ответственности:

| Класс | Файл | Ответственность |
|---|---|---|
| `CompanyExtractor` | `content_scripts/companyExtractor.js` | Извлечение данных из URL и DOM: извлечение кода компании из URL (`extractCode`), извлечение названия компании из DOM (`extractTitle`). Все методы статические — не зависит от браузерного storage и не выполняет сетевых запросов. |
| `CompanyApiClient` | `content_scripts/companyApiClient.js` | Работа с REST API: `sendCompany(code, title)` — POST-запрос добавления компании; `getStatuses(code)` — GET-запрос статусов компании. Base URL читается из настроек (`BrowserStorage`). |
| `CompanyProcessor` | `content_scripts/companyProcessor.js` | Оркестратор (точка входа): ждёт загрузки страницы, проверяет корректность URL, извлекает данные через `CompanyExtractor.extractCode()` / `extractTitle()`, передаёт их в `CompanyApiClient.sendCompany()`, отображает результат через `MessageControl`, затем запрашивает статусы через `CompanyApiClient.getStatuses()` и выводит их через `StatusBadges`. |
| `StatusBadges` | `content_scripts/statusBadges.js` | Отображение индикаторов статусов: вставляет после ссылки с названием компании (`.info a.name`) цветные бейджи со значениями `action_industry` и `action_company`. Цвет бейджа зависит от кода статуса. |

### Поток данных

```
CompanyProcessor (оркестратор)
    │
    ├── CompanyExtractor (статические методы) → { code, title }
    │
    ├── CompanyApiClient.sendCompany(code, title) → responseText
    │       │
    │       └── BrowserStorage (base URL из настроек)
    │
    ├── CompanyApiClient.getStatuses(code) → { action_industry, action_company }
    │
    └── StatusBadges.render(statuses) → бейджи рядом с названием компании
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
│   ├── statusBadges.js                          # Индикаторы статусов компании рядом с названием
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
