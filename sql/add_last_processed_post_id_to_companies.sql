-- Adds per-company post crawl progress tracking to the companies table.
-- Mirrors add_last_processed_article_id_to_companies.sql.
-- Idempotent: safe to run repeatedly on any MySQL 5.7/8.x server.

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'companies'
      AND COLUMN_NAME = 'last_processed_post_id'
);

SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE companies ADD COLUMN last_processed_post_id BIGINT UNSIGNED NULL DEFAULT NULL COMMENT ''Last post_id processed by the crawler, per company''',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
