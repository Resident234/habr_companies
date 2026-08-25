package dbop

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

var db *sql.DB

// InitDB подключается к MySQL по переменным окружения.
// Вызывать один раз при старте приложения; при ошибке процесс должен завершиться.
func InitDB() error {
	host := os.Getenv("DB_HOST")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")

	if host == "" || user == "" || dbname == "" {
		return fmt.Errorf("DB_HOST, DB_USER, DB_NAME must be set")
	}

	dsn := fmt.Sprintf(
		"%s:%s@tcp(%s)/%s?parseTime=true&charset=utf8mb4&collation=utf8mb4_unicode_ci",
		user, password, host, dbname,
	)
	conn, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("open mysql: %w", err)
	}
	conn.SetMaxOpenConns(25)
	conn.SetMaxIdleConns(25)
	conn.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err = conn.PingContext(ctx); err != nil {
		_ = conn.Close()
		return fmt.Errorf("ping mysql: %w", err)
	}

	db = conn
	log.Println("connected to MySQL")
	return nil
}

// UpsertCompany добавляет или обновляет компанию. Возвращает true, если запись создана.
func UpsertCompany(code, title string) (created bool, err error) {
	if db == nil {
		return false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := db.ExecContext(ctx,
		"INSERT INTO companies (code, title) VALUES (?, ?) ON DUPLICATE KEY UPDATE title = ?",
		code, title, title,
	)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	// RowsAffected для INSERT ... ON DUPLICATE KEY UPDATE:
	// 1 — новая строка, 2 — обновлена существующая, 0 — значения не изменились.
	return rows == 1, nil
}

// UpsertArticle добавляет или обновляет статью по внешнему Habr ID.
// ID статьи передаётся явно, чтобы он совпадал с ID в URL Habr.
func UpsertArticle(articleID int64, title, companyCode string) (created bool, err error) {
	if db == nil {
		return false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := db.ExecContext(ctx,
		"INSERT INTO articles (id, title, company) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE title = ?, company = ?",
		articleID, title, companyCode, title, companyCode,
	)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	// Для INSERT ... ON DUPLICATE KEY UPDATE: 1 — новая строка,
	// 2 — обновлена существующая, 0 — данные уже совпадают.
	return rows == 1, nil
}

// UpsertCategory добавляет или обновляет отрасль. Возвращает true, если запись создана.
func UpsertCategory(code, title string) (created bool, err error) {
	if db == nil {
		return false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := db.ExecContext(ctx,
		"INSERT INTO category (code, title) VALUES (?, ?) ON DUPLICATE KEY UPDATE title = ?",
		code, title, title,
	)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows == 1, nil
}

// CompanyStatus — значение action-колонки компании вместе с title из справочника statuses.
type CompanyStatus struct {
	Code  string `json:"code"`
	Title string `json:"title"`
}

// CompanyStatuses — статусы компании по полям action_dev, action_industry и action_company.
type CompanyStatuses struct {
	Code           string         `json:"code"`
	ActionDev      *CompanyStatus `json:"action_dev"`
	ActionIndustry *CompanyStatus `json:"action_industry"`
	ActionCompany  *CompanyStatus `json:"action_company"`
}

// GetCompanyStatuses возвращает статусы action_dev, action_industry и action_company
// компании с человекочитаемыми title из связанной таблицы statuses.
// found == false, если компания с таким code не найдена.
func GetCompanyStatuses(code string) (statuses *CompanyStatuses, found bool, err error) {
	if db == nil {
		return nil, false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		devCode, devTitle           string
		industryCode, industryTitle string
		companyCode, companyTitle   string
	)
	err = db.QueryRowContext(ctx, `
		SELECT c.code,
		       sd.code, sd.title,
		       si.code, si.title,
		       sc.code, sc.title
		FROM companies c
		JOIN statuses sd ON sd.code = c.action_dev
		JOIN statuses si ON si.code = c.action_industry
		JOIN statuses sc ON sc.code = c.action_company
		WHERE c.code = ?`, code,
	).Scan(&code, &devCode, &devTitle, &industryCode, &industryTitle, &companyCode, &companyTitle)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}

	return &CompanyStatuses{
		Code:           code,
		ActionDev:      &CompanyStatus{Code: devCode, Title: devTitle},
		ActionIndustry: &CompanyStatus{Code: industryCode, Title: industryTitle},
		ActionCompany:  &CompanyStatus{Code: companyCode, Title: companyTitle},
	}, true, nil
}

// ArticleStatuses — статусы статьи по полям action_dev, action_post, action_comment,
// action_industry и action_company.
type ArticleStatuses struct {
	ID             int64          `json:"id"`
	Company        string         `json:"company"`
	ActionDev      *CompanyStatus `json:"action_dev"`
	ActionPost     *CompanyStatus `json:"action_post"`
	ActionComment  *CompanyStatus `json:"action_comment"`
	ActionIndustry *CompanyStatus `json:"action_industry"`
	ActionCompany  *CompanyStatus `json:"action_company"`
}

// GetArticleStatuses возвращает статусы статьи (таблица articles) по коду компании
// и id статьи, с человекочитаемыми title из связанной таблицы statuses.
// found == false, если статья с такими company и id не найдена.
func GetArticleStatuses(companyCode string, articleID int64) (statuses *ArticleStatuses, found bool, err error) {
	if db == nil {
		return nil, false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		devCode, devTitle           string
		postCode, postTitle         string
		commentCode, commentTitle   string
		industryCode, industryTitle string
		companyStatusCode           string
		companyTitle                string
	)
	err = db.QueryRowContext(ctx, `
		SELECT a.id, a.company,
		       sd.code, sd.title,
		       sp.code, sp.title,
		       sm.code, sm.title,
		       si.code, si.title,
		       sc.code, sc.title
		FROM articles a
		LEFT JOIN statuses sd ON sd.code = a.action_dev
		LEFT JOIN statuses sp ON sp.code = a.action_post
		LEFT JOIN statuses sm ON sm.code = a.action_comment
		LEFT JOIN statuses si ON si.code = a.action_industry
		LEFT JOIN statuses sc ON sc.code = a.action_company
		WHERE a.company = ? AND a.id = ?`, companyCode, articleID,
	).Scan(
		&articleID, &companyCode,
		&devCode, &devTitle,
		&postCode, &postTitle,
		&commentCode, &commentTitle,
		&industryCode, &industryTitle,
		&companyStatusCode, &companyTitle,
	)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}

	return &ArticleStatuses{
		ID:             articleID,
		Company:        companyCode,
		ActionDev:      &CompanyStatus{Code: devCode, Title: devTitle},
		ActionPost:     &CompanyStatus{Code: postCode, Title: postTitle},
		ActionComment:  &CompanyStatus{Code: commentCode, Title: commentTitle},
		ActionIndustry: &CompanyStatus{Code: industryCode, Title: industryTitle},
		ActionCompany:  &CompanyStatus{Code: companyStatusCode, Title: companyTitle},
	}, true, nil
}

// NewsStatuses — статусы новости по полям action_dev, action_post, action_comment,
// action_industry и action_company. Структура совпадает с ArticleStatuses.
type NewsStatuses struct {
	ID             int64          `json:"id"`
	Company        string         `json:"company"`
	ActionDev      *CompanyStatus `json:"action_dev"`
	ActionPost     *CompanyStatus `json:"action_post"`
	ActionComment  *CompanyStatus `json:"action_comment"`
	ActionIndustry *CompanyStatus `json:"action_industry"`
	ActionCompany  *CompanyStatus `json:"action_company"`
}

// GetNewsStatuses возвращает статусы новости (таблица news) по коду компании
// и id новости, с человекочитаемыми title из связанной таблицы statuses.
// found == false, если новость с такими company и id не найдена.
func GetNewsStatuses(companyCode string, newsID int64) (statuses *NewsStatuses, found bool, err error) {
	if db == nil {
		return nil, false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		devCode, devTitle           string
		postCode, postTitle         string
		commentCode, commentTitle   string
		industryCode, industryTitle string
		companyStatusCode           string
		companyTitle                string
	)
	err = db.QueryRowContext(ctx, `
		SELECT n.id, n.company,
		       sd.code, sd.title,
		       sp.code, sp.title,
		       sm.code, sm.title,
		       si.code, si.title,
		       sc.code, sc.title
		FROM news n
		LEFT JOIN statuses sd ON sd.code = n.action_dev
		LEFT JOIN statuses sp ON sp.code = n.action_post
		LEFT JOIN statuses sm ON sm.code = n.action_comment
		LEFT JOIN statuses si ON si.code = n.action_industry
		LEFT JOIN statuses sc ON sc.code = n.action_company
		WHERE n.company = ? AND n.id = ?`, companyCode, newsID,
	).Scan(
		&newsID, &companyCode,
		&devCode, &devTitle,
		&postCode, &postTitle,
		&commentCode, &commentTitle,
		&industryCode, &industryTitle,
		&companyStatusCode, &companyTitle,
	)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}

	return &NewsStatuses{
		ID:             newsID,
		Company:        companyCode,
		ActionDev:      &CompanyStatus{Code: devCode, Title: devTitle},
		ActionPost:     &CompanyStatus{Code: postCode, Title: postTitle},
		ActionComment:  &CompanyStatus{Code: commentCode, Title: commentTitle},
		ActionIndustry: &CompanyStatus{Code: industryCode, Title: industryTitle},
		ActionCompany:  &CompanyStatus{Code: companyStatusCode, Title: companyTitle},
	}, true, nil
}

// PostStatuses — статусы поста по полям action_dev, action_post, action_comment,
// action_industry и action_company. Структура совпадает с NewsStatuses.
type PostStatuses = NewsStatuses

// PostsStatuses — результат пакетного запроса статусов постов компании.
// Включает только те посты, что найдены в таблице posts.
type PostsStatuses struct {
	Company string          `json:"company"`
	Posts   []*PostStatuses `json:"posts"`
}

// maxBatchIDs — максимальное число id в одном пакетном запросе
// (защита от слишком длинных IN-списков).
const maxBatchIDs = 100

// GetPostsStatuses возвращает статусы постов (таблица posts) по коду компании
// и списку id, с человекочитаемыми title из связанной таблицы statuses.
// Посты, отсутствующие в таблице, просто не включаются в ответ.
func GetPostsStatuses(companyCode string, ids []int64) (statuses *PostsStatuses, err error) {
	if db == nil {
		return nil, fmt.Errorf("database not initialized")
	}

	result := &PostsStatuses{Company: companyCode, Posts: []*PostStatuses{}}
	if len(ids) == 0 {
		return result, nil
	}
	if len(ids) > maxBatchIDs {
		return nil, fmt.Errorf("too many ids: %d (max %d)", len(ids), maxBatchIDs)
	}

	placeholders := strings.TrimSuffix(strings.Repeat("?,", len(ids)), ",")
	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, companyCode)
	for _, id := range ids {
		args = append(args, id)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, `
		SELECT p.id, p.company,
		       sd.code, sd.title,
		       sp.code, sp.title,
		       sm.code, sm.title,
		       si.code, si.title,
		       sc.code, sc.title
		FROM posts p
		LEFT JOIN statuses sd ON sd.code = p.action_dev
		LEFT JOIN statuses sp ON sp.code = p.action_post
		LEFT JOIN statuses sm ON sm.code = p.action_comment
		LEFT JOIN statuses si ON si.code = p.action_industry
		LEFT JOIN statuses sc ON sc.code = p.action_company
		WHERE p.company = ? AND p.id IN (`+placeholders+`)`, args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var (
			postID                      int64
			company                     string
			devCode, devTitle           string
			postCode, postTitle         string
			commentCode, commentTitle   string
			industryCode, industryTitle string
			companyStatusCode           string
			compTitle                   string
		)
		if err := rows.Scan(
			&postID, &company,
			&devCode, &devTitle,
			&postCode, &postTitle,
			&commentCode, &commentTitle,
			&industryCode, &industryTitle,
			&companyStatusCode, &compTitle,
		); err != nil {
			return nil, err
		}

		result.Posts = append(result.Posts, &PostStatuses{
			ID:             postID,
			Company:        company,
			ActionDev:      &CompanyStatus{Code: devCode, Title: devTitle},
			ActionPost:     &CompanyStatus{Code: postCode, Title: postTitle},
			ActionComment:  &CompanyStatus{Code: commentCode, Title: commentTitle},
			ActionIndustry: &CompanyStatus{Code: industryCode, Title: industryTitle},
			ActionCompany:  &CompanyStatus{Code: companyStatusCode, Title: compTitle},
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

// Comment — структура закладки комментария.
type Comment struct {
	ID         int64  `json:"id"`
	Text       string `json:"text"`
	EntityCode string `json:"entity_code"`
	EntityID   int64  `json:"entity_id"`
	CommentID  int64  `json:"comment_id"`
	CreatedAt  string `json:"created_at"`
}

// UpsertComment добавляет или обновляет закладку комментария.
// Возвращает true, если запись создана.
func UpsertComment(text, entityCode string, entityID, commentID int64) (created bool, err error) {
	if db == nil {
		return false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := db.ExecContext(ctx,
		"INSERT INTO comments (text, entity_code, entity_id, comment_id) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE text = ?",
		text, entityCode, entityID, commentID, text,
	)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	// RowsAffected для INSERT ... ON DUPLICATE KEY UPDATE:
	// 1 — новая строка, 2 — обновлена существующая, 0 — значения не изменились.
	return rows == 1, nil
}

// DeleteComment удаляет закладку комментария по comment_id.
// Возвращает true, если запись удалена.
func DeleteComment(commentID int64) (deleted bool, err error) {
	if db == nil {
		return false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := db.ExecContext(ctx, "DELETE FROM comments WHERE comment_id = ?", commentID)
	if err != nil {
		return false, err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rows > 0, nil
}
