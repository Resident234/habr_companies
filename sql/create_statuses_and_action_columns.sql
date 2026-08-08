-- ============================================================
-- Миграция: справочник статусов (statuses) и привязка к нему
-- полей action_* в таблицах posts, articles, news.
--
-- Статусы:
--   unprocessed  — Не обработано
--   backlog      — В бэклоге
--   in_progress  — В работе
--   done         — Завершено
-- ============================================================

-- 1) Справочник статусов.
-- ВАЖНО: collation колонки statuses.code должен совпадать с collation
-- колонок action_* в таблицах posts/articles/news. Эти таблицы в живой БД
-- используют collation соединения по умолчанию (utf8mb4_0900_ai_ci), поэтому
-- явно задаём тот же collation для statuses.code, иначе FK падает с ошибкой 3780.
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
    ('done',        'Завершено')
ON DUPLICATE KEY UPDATE title = VALUES(title);

-- 2) Таблица posts
ALTER TABLE posts
    ADD COLUMN action_dev      VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_post     VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_comment  VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_company  VARCHAR(255) NOT NULL DEFAULT 'unprocessed';

ALTER TABLE posts
    ADD CONSTRAINT fk_posts_action_dev      FOREIGN KEY (action_dev)      REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_posts_action_post     FOREIGN KEY (action_post)     REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_posts_action_comment  FOREIGN KEY (action_comment)  REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_posts_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_posts_action_company  FOREIGN KEY (action_company)  REFERENCES statuses (code) ON UPDATE CASCADE;

-- 3) Таблица articles
ALTER TABLE articles
    ADD COLUMN action_dev      VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_post     VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_comment  VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_company  VARCHAR(255) NOT NULL DEFAULT 'unprocessed';

ALTER TABLE articles
    ADD CONSTRAINT fk_articles_action_dev      FOREIGN KEY (action_dev)      REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_articles_action_post     FOREIGN KEY (action_post)     REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_articles_action_comment  FOREIGN KEY (action_comment)  REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_articles_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_articles_action_company  FOREIGN KEY (action_company)  REFERENCES statuses (code) ON UPDATE CASCADE;

-- 4) Таблица news
ALTER TABLE news
    ADD COLUMN action_dev      VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_post     VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_comment  VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_industry VARCHAR(255) NOT NULL DEFAULT 'unprocessed',
    ADD COLUMN action_company  VARCHAR(255) NOT NULL DEFAULT 'unprocessed';

ALTER TABLE news
    ADD CONSTRAINT fk_news_action_dev      FOREIGN KEY (action_dev)      REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_news_action_post     FOREIGN KEY (action_post)     REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_news_action_comment  FOREIGN KEY (action_comment)  REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_news_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE,
    ADD CONSTRAINT fk_news_action_company  FOREIGN KEY (action_company)  REFERENCES statuses (code) ON UPDATE CASCADE;
