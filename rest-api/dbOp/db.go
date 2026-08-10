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
