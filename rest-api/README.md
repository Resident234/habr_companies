# Сервис компаний

REST API для добавления и обновления компаний. Клиент — Chrome-расширение.

## Архитектура

```
rest-api/
├── operate/       # точка входа: .env, конфиг, InitDB, ListenAndServe
├── route/         # HTTP-маршруты, валидация, формирование JSON-ответов
├── middleware/    # HTTP-обёртки (аутентификация по API-ключу)
├── dbOp/          # модели и операции с MySQL
├── .env.example   # шаблон конфигурации
└── README.md
```

## Конфигурация

Параметры задаются переменными окружения:

| Переменная       | Описание                 | Пример                     |
|------------------|--------------------------|----------------------------|
| `DB_HOST`        | Хост и порт MySQL        | `127.0.0.1:3306`           |
| `DB_USER`        | Пользователь MySQL       | `root`                     |
| `DB_PASSWORD`    | Пароль MySQL             | (пусто или ваш пароль)     |
| `DB_NAME`        | Имя базы данных          | `habr_companies`           |
| `COMPANY_API_KEY`| Секретный ключ API       | `c5f8a9d1e3b2...`         |
| `HTTP_ADDR`      | Адрес HTTP-сервера (опц.)| `:8080`                   |

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

1. Запустите сервис локально (порт `8080`).
2. Откройте новый терминал и запустите туннель:
   ```cmd
   ngrok http 8080
   ```
3. Используйте HTTPS-URL из вывода ngrok как адрес API в Chrome-расширении.
4. Убедитесь, что Windows Firewall не блокирует входящие соединения для `ngrok.exe`.

### Использование в Chrome-расширении

**Конфигурация для расширения:**
- **Базовый URL**: `https://xxxx-xx-xxx.ngrok-free.dev` (получить из вывода ngrok)
- **Endpoint**: `POST /company/add/{code}/{title}`
- **Заголовок аутентификации**: `X-API-Key: <ваш-секретный-ключ-из-.env>`

**Пример запроса:**
```bash
curl -X POST \
  "https://xxxx-xx-xxx.ngrok-free.dev/company/add/yandex/%D0%AF%D0%BD%D0%B4%D0%B5%D0%BA%D1%81" \
  -H "X-API-Key: your-api-key-here"
```

**Веб-интерфейс ngrok:** http://localhost:4040 (просмотр трафика и логов)

## Тестирование

```bash
# модульные тесты (БД не требуется)
go test ./...

# интеграционные тесты (требуют MySQL)
go test -tags=integration ./...
```

## База данных

Таблица `companies` создаётся вручную (см. `sql/create_companies_table.sql`):

```sql
CREATE TABLE companies (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);