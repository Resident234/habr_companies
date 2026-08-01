CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    stats_counter VARCHAR(255),
    hub INT,
    score_counter INT,
    bookmarks_counter INT,
    comments_counter INT,
    FOREIGN KEY (hub) REFERENCES hubs(id)
);