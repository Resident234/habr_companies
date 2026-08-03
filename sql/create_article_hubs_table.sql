-- Связная таблица many-to-many: у статьи может быть несколько хабов
CREATE TABLE IF NOT EXISTS article_hubs (
    article_id INT NOT NULL,
    hub_id INT NOT NULL,
    PRIMARY KEY (article_id, hub_id),
    CONSTRAINT fk_article_hubs_article FOREIGN KEY (article_id) REFERENCES articles (id) ON DELETE CASCADE,
    CONSTRAINT fk_article_hubs_hub FOREIGN KEY (hub_id) REFERENCES hubs (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
