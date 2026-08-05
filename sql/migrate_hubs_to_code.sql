-- Migration: make `hubs.code` the primary key and switch `article_hubs` to use hub_code
-- Safe to run when `hubs` contains no actual data (or when you prepared a backup).
-- This script is idempotent and tries to be safe on repeated runs.

-- NOTE: Run on a copy of the database first. Some DDL operations may perform implicit commits.

-- 1) Add hub_code column to article_hubs if missing
SET @exists := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_code'
);
SET @ddl := IF(@exists = 0,
  'ALTER TABLE article_hubs ADD COLUMN hub_code VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Populate hub_code from hubs.id -> hubs.code (no-op if hubs empty)
SET @has_hubid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_id'
);
SET @populate := IF(@has_hubid > 0,
  'UPDATE article_hubs ah JOIN hubs h ON ah.hub_id = h.id SET ah.hub_code = h.code',
  'SELECT 1'
);
PREPARE stmt FROM @populate; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3) Drop any foreign key(s) in article_hubs that reference hubs (by any column)
SELECT CONSTRAINT_NAME INTO @fk_name
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND REFERENCED_TABLE_NAME = 'hubs'
  LIMIT 1;
SET @ddl := IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE article_hubs DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4) Add foreign key from article_hubs(hub_code) -> hubs(code) if missing
SELECT COUNT(*) INTO @has_fk_code
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND REFERENCED_TABLE_NAME = 'hubs' AND REFERENCED_COLUMN_NAME = 'code';
SET @ddl := IF(@has_fk_code = 0,
  'ALTER TABLE article_hubs ADD CONSTRAINT fk_article_hubs_hub_code FOREIGN KEY (hub_code) REFERENCES hubs (code) ON DELETE CASCADE',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 5) Drop hub_id column from article_hubs if present
SET @exists_hubid := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_id'
);
SET @ddl := IF(@exists_hubid > 0,
  'ALTER TABLE article_hubs DROP COLUMN hub_id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 6) If hubs.id exists, drop it and make code the primary key
SELECT COUNT(*) INTO @has_id_col FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs' AND COLUMN_NAME = 'id';

IF @has_id_col > 0 THEN
  -- Drop any foreign keys in other tables referencing hubs.id
  SELECT CONCAT('ALTER TABLE `', TABLE_NAME, '` DROP FOREIGN KEY `', CONSTRAINT_NAME, '`')
    INTO @dropfk
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = 'hubs' AND REFERENCED_COLUMN_NAME = 'id'
    LIMIT 1;
  IF @dropfk IS NOT NULL THEN
    PREPARE stmt FROM @dropfk; EXECUTE stmt; DEALLOCATE PREPARE stmt;
  END IF;

  -- Drop PRIMARY KEY on hubs if present
  SET @pk_exists := (
    SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs' AND CONSTRAINT_TYPE = 'PRIMARY KEY'
  );
  SET @ddl := IF(@pk_exists > 0, 'ALTER TABLE hubs DROP PRIMARY KEY', 'SELECT 1');
  PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

  -- Drop id column
  SET @ddl := 'ALTER TABLE hubs DROP COLUMN id';
  PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;
END IF;

-- 7) Ensure hubs.code is NOT NULL and is PRIMARY KEY
SELECT COUNT(*) INTO @code_is_pk
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs' AND COLUMN_NAME = 'code' AND CONSTRAINT_NAME = 'PRIMARY';
SET @ddl := IF(@code_is_pk = 0,
  'ALTER TABLE hubs MODIFY COLUMN code VARCHAR(255) NOT NULL, ADD PRIMARY KEY (code)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Final sanity checks (informational)
SELECT
  (SELECT COUNT(*) FROM hubs) AS hubs_rows,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'hubs' AND COLUMN_NAME = 'id') AS hubs_has_id_column,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'article_hubs' AND COLUMN_NAME = 'hub_code') AS article_hubs_has_hub_code;

-- End of migration

