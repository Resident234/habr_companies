-- Связная таблица many-to-many: у поста может быть несколько хабов
CREATE TABLE IF NOT EXISTS post_hubs (
    post_id INT NOT NULL,
    hub_code VARCHAR(255) NOT NULL,
    PRIMARY KEY (post_id, hub_code),
    CONSTRAINT fk_post_hubs_post FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
    CONSTRAINT fk_post_hubs_hub FOREIGN KEY (hub_code) REFERENCES hubs (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
