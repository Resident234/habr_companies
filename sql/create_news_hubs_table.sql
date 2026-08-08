-- Связная таблица many-to-many: у новости может быть несколько хабов
CREATE TABLE IF NOT EXISTS news_hubs (
    news_id INT NOT NULL,
    hub_code VARCHAR(255) NOT NULL,
    PRIMARY KEY (news_id, hub_code),
    CONSTRAINT fk_news_hubs_news FOREIGN KEY (news_id) REFERENCES news (id) ON DELETE CASCADE,
    CONSTRAINT fk_news_hubs_hub FOREIGN KEY (hub_code) REFERENCES hubs (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
