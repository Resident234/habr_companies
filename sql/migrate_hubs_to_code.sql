-- Simplified migration for hubs when tables are empty
-- Assumes `hubs` and `article_hubs` contain no data. Still performs
-- existence checks for safety. Run on a copy / after backup.

-- 0) Quick safety check: proceed only if hubs is empty
SET @hubs_rows := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs');
SET @cnt := 0;
IF @hubs_rows > 0 THEN
  SELECT COUNT(*) INTO @cnt FROM hubs;
END IF;

-- If hubs has rows, do nothing (abort). If empty (or table absent), continue with DDL.
SET @do_it := IF(@cnt = 0, 1, 0);

-- 1) If hubs has an `id` column, drop it and make `code` the PK
SET @has_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs' AND COLUMN_NAME = 'id'
);
SET @ddl := IF(@do_it = 1 AND @has_id > 0,
  'ALTER TABLE hubs DROP COLUMN id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @code_pk := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs' AND COLUMN_NAME = 'code' AND CONSTRAINT_NAME = 'PRIMARY'
);
SET @ddl := IF(@do_it = 1 AND @code_pk = 0,
  'ALTER TABLE hubs MODIFY COLUMN code VARCHAR(255) NOT NULL, ADD PRIMARY KEY (code)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Adjust article_hubs: add hub_code, drop hub_id, add FK to hubs(code)
SET @has_hubcode := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_code'
);
SET @ddl := IF(@has_hubcode = 0,
  'ALTER TABLE article_hubs ADD COLUMN hub_code VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- If hub_id exists, drop it (we assume no data to migrate)
SET @has_hubid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_id'
);
SET @ddl := IF(@has_hubid > 0,
  'ALTER TABLE article_hubs DROP COLUMN hub_id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Add FK from article_hubs(hub_code) -> hubs(code) if missing
SET @has_fk_code := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND REFERENCED_TABLE_NAME = 'hubs' AND REFERENCED_COLUMN_NAME = 'code'
);
SET @ddl := IF(@has_fk_code = 0,
  'ALTER TABLE article_hubs ADD CONSTRAINT fk_article_hubs_hub_code FOREIGN KEY (hub_code) REFERENCES hubs (code) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Final sanity info
SELECT
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs') AS hubs_exists,
  (SELECT COUNT(*) FROM hubs) AS hubs_rows,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_code') AS article_hubs_has_hub_code;

-- End simplified migration

