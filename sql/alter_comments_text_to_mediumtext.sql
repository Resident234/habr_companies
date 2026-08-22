-- Увеличивает вместимость текста комментария в уже существующей таблице.
-- MEDIUMTEXT поддерживает до 16 MiB текста, что больше текущего лимита тела REST-запроса 8 MiB.
ALTER TABLE comments
    MODIFY COLUMN text MEDIUMTEXT NOT NULL;
