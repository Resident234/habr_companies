CREATE TABLE companies (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    last_processed_article_id BIGINT UNSIGNED NULL DEFAULT NULL
);
