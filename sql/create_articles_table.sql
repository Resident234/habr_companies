CREATE TABLE hubs (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE labels (
    code VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    stats_counter VARCHAR(255),
    label VARCHAR(255),
    company VARCHAR(255),
    score_counter INT,
    bookmarks_counter INT,
    comments_counter INT,
    FOREIGN KEY (label) REFERENCES labels(code),
    FOREIGN KEY (company) REFERENCES companies(code)
);