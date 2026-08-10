-- Справочник статусов нужен для FK action_*. IF NOT EXISTS + ON DUPLICATE
-- делают блок безопасным при повторном запуске и в связке с другими create-файлами.
CREATE TABLE IF NOT EXISTS statuses (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO statuses (code, title) VALUES
    ('unprocessed', 'Не обработано'),
    ('backlog',     'В бэклоге'),
    ('in_progress', 'В работе'),
    ('done',        'Завершено'),
    ('rejected',    'Отклонено') AS s
ON DUPLICATE KEY UPDATE title = s.title;

CREATE TABLE news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    stats_counter VARCHAR(255),
    company VARCHAR(255),
    score_counter INT,
    bookmarks_counter INT,
    comments_counter INT,
    action_dev      VARCHAR(255) NOT NULL DEFAULT 'unprocessed' COLLATE utf8mb4_0900_ai_ci,
    action_post     VARCHAR(255) NOT NULL DEFAULT 'unprocessed' COLLATE utf8mb4_0900_ai_ci,
    action_comment  VARCHAR(255) NOT NULL DEFAULT 'unprocessed' COLLATE utf8mb4_0900_ai_ci,
    action_industry VARCHAR(255) NOT NULL DEFAULT 'unprocessed' COLLATE utf8mb4_0900_ai_ci,
    action_company  VARCHAR(255) NOT NULL DEFAULT 'unprocessed' COLLATE utf8mb4_0900_ai_ci,
    FOREIGN KEY (company) REFERENCES companies(code),
    CONSTRAINT fk_news_action_dev      FOREIGN KEY (action_dev)      REFERENCES statuses (code) ON UPDATE CASCADE,
    CONSTRAINT fk_news_action_post     FOREIGN KEY (action_post)     REFERENCES statuses (code) ON UPDATE CASCADE,
    CONSTRAINT fk_news_action_comment  FOREIGN KEY (action_comment)  REFERENCES statuses (code) ON UPDATE CASCADE,
    CONSTRAINT fk_news_action_industry FOREIGN KEY (action_industry) REFERENCES statuses (code) ON UPDATE CASCADE,
    CONSTRAINT fk_news_action_company  FOREIGN KEY (action_company)  REFERENCES statuses (code) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
