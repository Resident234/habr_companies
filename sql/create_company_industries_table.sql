-- Связная таблица many-to-many: у компании может быть несколько отраслей
CREATE TABLE IF NOT EXISTS company_industries (
    company_code VARCHAR(255) NOT NULL,
    industry_code VARCHAR(255) NOT NULL,
    PRIMARY KEY (company_code, industry_code),
    CONSTRAINT fk_company_industries_company FOREIGN KEY (company_code) REFERENCES companies (code) ON DELETE CASCADE,
    CONSTRAINT fk_company_industries_industry FOREIGN KEY (industry_code) REFERENCES category (code) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
