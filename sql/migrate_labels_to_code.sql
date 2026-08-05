-- Migration: convert labels table to use `code` PRIMARY KEY instead of numeric `id`.
-- Simplified migration for labels when tables are empty
-- Assumes `labels` and referencing places contain no data. Run on a copy / after backup.

-- Safety: proceed only if labels table exists and is empty
SET @labels_exists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'labels');
SET @cnt := 0;
IF @labels_exists > 0 THEN
  SELECT COUNT(*) INTO @cnt FROM labels;
END IF;

SET @do_it := IF(@cnt = 0, 1, 0);

-- 1) If labels has numeric id, drop it and make code PRIMARY KEY
SET @has_id := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'labels' AND COLUMN_NAME = 'id'
);
SET @ddl := IF(@do_it = 1 AND @has_id > 0,
  'ALTER TABLE labels DROP COLUMN id',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @code_pk := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'labels' AND COLUMN_NAME = 'code' AND CONSTRAINT_NAME = 'PRIMARY'
);
SET @ddl := IF(@do_it = 1 AND @code_pk = 0,
  'ALTER TABLE labels MODIFY COLUMN code VARCHAR(255) NOT NULL, ADD PRIMARY KEY (code)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2) Ensure articles.label is VARCHAR and FK references labels(code)
SET @has_label_col := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'label'
);
-- If label column exists and is not varchar, alter it
SET @ddl := IF(@has_label_col = 1,
  'ALTER TABLE articles MODIFY COLUMN label VARCHAR(255) NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Drop any FK pointing to labels.id and add FK to labels.code
SELECT CONSTRAINT_NAME INTO @fk_name
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND REFERENCED_TABLE_NAME = 'labels'
  LIMIT 1;
SET @ddl := IF(@fk_name IS NOT NULL,
  CONCAT('ALTER TABLE articles DROP FOREIGN KEY `', @fk_name, '`'),
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk_code := (
  SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND REFERENCED_TABLE_NAME = 'labels' AND REFERENCED_COLUMN_NAME = 'code'
);
SET @ddl := IF(@has_fk_code = 0,
  'ALTER TABLE articles ADD CONSTRAINT fk_articles_label_code FOREIGN KEY (label) REFERENCES labels (code) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt FROM @ddl; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Final sanity info
SELECT
  (SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'labels') AS labels_exists,
  (SELECT COUNT(*) FROM labels) AS labels_rows,
  (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'articles' AND COLUMN_NAME = 'label') AS articles_has_label_column;

-- End simplified migration

