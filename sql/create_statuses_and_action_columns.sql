-- ============================================================
-- Миграция (ИДЕМПОТЕНТНАЯ): справочник статусов (statuses)
-- и колонки action_* с FK на него.
--   - posts/articles/news: action_dev, action_post, action_comment,
--                          action_industry, action_company
--   - companies:           action_industry, action_company
--
-- Повторный запуск безопасен: каждая колонка и каждый FK
-- добавляются только если их ещё нет (проверка через
-- information_schema + PREPARE). Тот же подход, что в add_link_to_companies.sql.
--
-- Статусы:
--   unprocessed  — Не обработано
--   backlog      — В бэклоге
--   in_progress  — В работе
--   done         — Завершено
-- ============================================================

-- 1) Справочник статусов.
-- ВАЖНО: collation колонки statuses.code должен совпадать с collation
-- колонок action_*. В живой БД таблицы постов/статей/новостей используют
-- collation соединения по умолчанию (utf8mb4_0900_ai_ci), поэтому явно задаём
-- тот же collation для statuses.code и для каждой колонки action_*,
-- иначе FK падает с ошибкой 3780.
CREATE TABLE IF NOT EXISTS statuses (
    code  VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Если таблица уже существовала с другим collation — приводим колонку code
-- к collation соединения, чтобы FK не падали.
ALTER TABLE statuses
    MODIFY COLUMN code VARCHAR(255) NOT NULL COLLATE utf8mb4_0900_ai_ci;

INSERT INTO statuses (code, title) VALUES
    ('unprocessed', 'Не обработано'),
    ('backlog',     'В бэклоге'),
    ('in_progress', 'В работе'),
    ('done',        'Завершено') AS s
ON DUPLICATE KEY UPDATE title = s.title;

-- 2) Колонки action_* и FK добавляются идемпотентно. Колонки создаются с
--    collation, совпадающим со statuses.code, иначе FK падает с ошибкой 3780.

-- === posts ===
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='posts' AND COLUMN_NAME IN ('action_dev','action_post','action_comment','action_industry','action_company'));
SET @sql := IF(@c = 5, 'SELECT 1', 'ALTER TABLE posts ADD COLUMN action_dev VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_post VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_comment VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_company VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='posts' AND CONSTRAINT_NAME LIKE 'fk\_posts\_action\_%');
SET @sql := IF(@c = 5, 'SELECT 1', 'ALTER TABLE posts ADD CONSTRAINT fk_posts_action_dev FOREIGN KEY (action_dev) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_posts_action_post FOREIGN KEY (action_post) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_posts_action_comment FOREIGN KEY (action_comment) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_posts_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_posts_action_company FOREIGN KEY (action_company) REFERENCES statuses (code) ON UPDATE CASCADE');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- === articles ===
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='articles' AND COLUMN_NAME IN ('action_dev','action_post','action_comment','action_industry','action_company'));
SET @sql := IF(@c = 5, 'SELECT 1', 'ALTER TABLE articles ADD COLUMN action_dev VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_post VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_comment VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_company VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='articles' AND CONSTRAINT_NAME LIKE 'fk\_articles\_action\_%');
SET @sql := IF(@c = 5, 'SELECT 1', 'ALTER TABLE articles ADD CONSTRAINT fk_articles_action_dev FOREIGN KEY (action_dev) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_articles_action_post FOREIGN KEY (action_post) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_articles_action_comment FOREIGN KEY (action_comment) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_articles_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_articles_action_company FOREIGN KEY (action_company) REFERENCES statuses (code) ON UPDATE CASCADE');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- === news ===
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='news' AND COLUMN_NAME IN ('action_dev','action_post','action_comment','action_industry','action_company'));
SET @sql := IF(@c = 5, 'SELECT 1', 'ALTER TABLE news ADD COLUMN action_dev VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_post VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_comment VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_company VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='news' AND CONSTRAINT_NAME LIKE 'fk\_news\_action\_%');
SET @sql := IF(@c = 5, 'SELECT 1', 'ALTER TABLE news ADD CONSTRAINT fk_news_action_dev FOREIGN KEY (action_dev) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_news_action_post FOREIGN KEY (action_post) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_news_action_comment FOREIGN KEY (action_comment) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_news_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_news_action_company FOREIGN KEY (action_company) REFERENCES statuses (code) ON UPDATE CASCADE');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- === companies (только эти две) ===
SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='companies' AND COLUMN_NAME IN ('action_industry','action_company'));
SET @sql := IF(@c = 2, 'SELECT 1', 'ALTER TABLE companies ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci, ADD COLUMN action_company VARCHAR(255) NOT NULL DEFAULT ''unprocessed'' COLLATE utf8mb4_0900_ai_ci');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @c := (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME='companies' AND CONSTRAINT_NAME LIKE 'fk\_companies\_action\_%');
SET @sql := IF(@c = 2, 'SELECT 1', 'ALTER TABLE companies ADD CONSTRAINT fk_companies_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE, ADD CONSTRAINT fk_companies_action_company FOREIGN KEY (action_company) REFERENCES statuses (code) ON UPDATE CASCADE');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

