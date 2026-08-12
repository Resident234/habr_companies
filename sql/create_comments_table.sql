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

-- Таблица закладок комментариев
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    entity_code VARCHAR(50) NOT NULL,  -- 'news', 'articles', 'posts'
    entity_id INT NOT NULL,
    comment_id INT NOT NULL,           -- Habr's data-comment-body value
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_comment (comment_id, entity_code, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;