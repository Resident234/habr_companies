package dbop

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
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

// CompanyStatus — значение action-колонки компании вместе с title из справочника statuses.
type CompanyStatus struct {
	Code  string `json:"code"`
	Title string `json:"title"`
}

// CompanyStatuses — статусы компании по полям action_industry и action_company.
type CompanyStatuses struct {
	Code           string         `json:"code"`
	ActionIndustry *CompanyStatus `json:"action_industry"`
	ActionCompany  *CompanyStatus `json:"action_company"`
}

// GetCompanyStatuses возвращает статусы action_industry и action_company компании
// с человекочитаемыми title из связанной таблицы statuses.
// found == false, если компания с таким code не найдена.
func GetCompanyStatuses(code string) (statuses *CompanyStatuses, found bool, err error) {
	if db == nil {
		return nil, false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var (
		industryCode, industryTitle string
		companyCode, companyTitle   string
	)
	err = db.QueryRowContext(ctx, `
		SELECT c.code,
		       si.code, si.title,
		       sc.code, sc.title
		FROM companies c
		JOIN statuses si ON si.code = c.action_industry
		JOIN statuses sc ON sc.code = c.action_company
		WHERE c.code = ?`, code,
	).Scan(&code, &industryCode, &industryTitle, &companyCode, &companyTitle)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}

	return &CompanyStatuses{
		Code:           code,
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
