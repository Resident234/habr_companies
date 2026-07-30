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

Скрипты в папке `scripts/` настраивают автоматический запуск rest-api + ngrok при входе в систему через папку **Startup**. Прав администратора не требуется.

### Подготовка

1. **Установите ngrok**, если ещё не установлен:
   ```cmd
   scoop install ngrok
   ```
   или скачайте с [ngrok.com/download](https://ngrok.com/download).  
   Укажите путь к `ngrok.exe` в `scripts/start_service.ps1` (переменная `$NGROK_EXE`).

2. **Соберите исполняемый файл**:
   ```cmd
   .\scripts\build.bat
   ```
   Будет создан `rest-api.exe` в корне проекта. Бинарник не требует Go для запуска.

### Установка автозагрузки

Запустите PowerShell (обычный, без прав администратора):

```powershell
.\scripts\setup_autostart.ps1
```

Скрипт скопирует `scripts/start_rest_api.vbs` в папку `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`.

**Как это работает:**
1. При входе в систему Windows запускает `RestApiWithNgrok.vbs` из Startup.
2. VBS-скрипт неявно (скрытое окно) запускает `start_service.ps1`.
3. `start_service.ps1` запускает `rest-api.exe` + `ngrok http 8080`.

### Проверка

Перезагрузите Windows (или выполните `logoff` / `logon`) и убедитесь, что:

- Сервер доступен локально:
  ```cmd
  curl http://localhost:8080
  ```
- Веб-интерфейс ngrok открывается в браузере по адресу http://localhost:4040.
- HTTPS-URL из ngrok можно использовать в Chrome-расширении.

### Удаление автозагрузки

```powershell
.\scripts\setup_autostart.ps1 -Unregister
```

### Прочие скрипты

| Скрипт | Назначение |
|--------|-----------|
| `scripts/build.bat` | Компилирует `rest-api.exe` из `./operate` |
| `scripts/start_service.ps1` | Запускает `rest-api.exe` и `ngrok http 8080` |
| `scripts/start_rest_api.vbs` | VBS-обёртка для скрытого запуска PowerShell через Startup |
| `scripts/setup_autostart.ps1` | Устанавливает/удаляет VBS из папки Startup |

## База данных

Таблица `companies` создаётся вручную (см. `sql/create_companies_table.sql`):

```sql
CREATE TABLE companies (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);
