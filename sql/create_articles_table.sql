CREATE TABLE hubs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(255) NOT NULL,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE labels (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL
);

CREATE TABLE articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    stats_counter VARCHAR(255),
    hub INT,
    label INT,
    company VARCHAR(255),
    score_counter INT,
    bookmarks_counter INT,
    comments_counter INT,
    FOREIGN KEY (hub) REFERENCES hubs(id),
    FOREIGN KEY (label) REFERENCES labels(id),
    FOREIGN KEY (company) REFERENCES companies(code)
);