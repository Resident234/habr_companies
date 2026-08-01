-- Add company column and FK to articles, news, posts

ALTER TABLE articles
  ADD COLUMN company VARCHAR(255) NULL,
  ADD INDEX idx_articles_company (company),
  ADD CONSTRAINT fk_articles_company FOREIGN KEY (company) REFERENCES companies(code) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE news
  ADD COLUMN company VARCHAR(255) NULL,
  ADD INDEX idx_news_company (company),
  ADD CONSTRAINT fk_news_company FOREIGN KEY (company) REFERENCES companies(code) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE posts
  ADD COLUMN company VARCHAR(255) NULL,
  ADD INDEX idx_posts_company (company),
  ADD CONSTRAINT fk_posts_company FOREIGN KEY (company) REFERENCES companies(code) ON DELETE SET NULL ON UPDATE CASCADE;
