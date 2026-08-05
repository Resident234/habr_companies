-- Нормализация collation для колонок `code`, чтобы FK в company_categories работали.
-- Проблема: в живой БД companies.code имеет utf8mb4_0900_ai_ci, а category.code — utf8mb4_unicode_ci.
-- MySQL требует, чтобы referencing и referenced колонки имели одинаковые charset/collation (ошибка 3780).
-- Приводим обе колонки к utf8mb4_unicode_ci (как в остальных create-скриптах проекта).

ALTER TABLE companies
    MODIFY COLUMN code VARCHAR(255) NOT NULL
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE category
    MODIFY COLUMN code VARCHAR(255) NOT NULL
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
