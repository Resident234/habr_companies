-- Связная таблица many-to-many: у статьи может быть несколько хабов
CREATE TABLE IF NOT EXISTS article_hubs (
    article_id INT NOT NULL,
    hub_code VARCHAR(255) NOT NULL,
    PRIMARY KEY (article_id, hub_code),
    CONSTRAINT fk_article_hubs_article FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE,
    CONSTRAINT fk_article_hubs_hub FOREIGN KEY (hub_code) REFERENCES hubs (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
