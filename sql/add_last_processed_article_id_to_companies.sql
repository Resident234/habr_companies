-- Adds per-company crawl progress tracking to the companies table.
-- Note: MySQL does NOT support "ADD COLUMN IF NOT EXISTS" (that is MariaDB-only
-- syntax), so idempotency is implemented via information_schema + prepared
-- statements. Safe to run repeatedly on any MySQL 5.7/8.x server.

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'companies'
      AND COLUMN_NAME = 'last_processed_article_id'
);

SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE companies ADD COLUMN last_processed_article_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT ''Last article_id processed by the crawler, per company''',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
