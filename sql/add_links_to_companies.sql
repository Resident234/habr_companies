-- Adds widget links JSON column to the companies table.
-- The links are extracted from the company profile page element:
--   <ul class="tm-widget-links__list">
--     <a class="tm-widget-links__link" href="..." title="..." rel="nofollow noreferrer" target="_blank">...</a>
--   </ul>
-- Idempotent: safe to run repeatedly on any MySQL 5.7/8.x server.

SET @col_exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'companies'
      AND COLUMN_NAME = 'links'
);

SET @ddl := IF(
    @col_exists = 0,
    'ALTER TABLE companies ADD COLUMN links JSON NULL DEFAULT NULL COMMENT \'Widget links from tm-widget-links__list on profile page\'',
    'SELECT 1'
);

PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;