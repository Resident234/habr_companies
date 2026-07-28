# Habr Companies — расширение для браузера

Браузерное расширение для Chrome и Firefox (Manifest V3), которое извлекает информацию о компаниях со страниц habr.com и отправляет её в настроенный сервис.

## Функциональность

- **Экстракция данных компании** со страниц, подходящих под паттерн `https://habr.com/ru/companies/*`:
  - **Код компании** — извлекается из URL (например, `selectel` из `/ru/companies/selectel/`)
  - **Название компании** — извлекается из DOM элемента `.tm-company-profile-card .info a.name span`
- **Отправка данных в сервис** — POST-запрос на `{base_url}/company/add/{code}/{title}` с заголовком `X-API-Key`
- **Отображение ответа** — ответ сервиса выводится во всплывающем сообщении на странице через `MessageControl`
- **Настройка адреса сервиса** — URL сервиса можно изменить на странице настроек расширения
- **Автоматический запуск** — запрос отправляется после полной загрузки страницы

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
│   ├── habrCompanyExtractor.js                  # Основная бизнес-логика
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