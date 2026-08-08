-- Adds company website link column to the companies table.
-- The link is extracted from the company profile page element:
--   <a class="tm-company-basic-info__link" href="http://www.ya.ru/" target="_blank">www.ya.ru</a>
-- Idempotent: safe to run repeatedly on any MySQL 5.7/8.x server.

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'companies'
      AND COLUMN_NAME = 'link'
);

SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE companies ADD COLUMN link VARCHAR(512) NULL DEFAULT NULL COMMENT ''Company website url from the profile page''',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
