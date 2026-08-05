-- Связная таблица many-to-many: у компании может быть несколько категорий
CREATE TABLE IF NOT EXISTS company_categories (
    company_code VARCHAR(255) NOT NULL,
    category_code VARCHAR(255) NOT NULL,
    PRIMARY KEY (company_code, category_code),
    CONSTRAINT fk_company_categories_company FOREIGN KEY (company_code) REFERENCES companies (code) ON DELETE CASCADE,
    CONSTRAINT fk_company_categories_category FOREIGN KEY (category_code) REFERENCES category (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

