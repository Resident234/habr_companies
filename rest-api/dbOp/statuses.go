package dbop

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

// StatusOrder задаёт фиксированный порядок переключения статусов
// кнопками «Назад»/«Вперёд»: от первого к последнему.
var StatusOrder = []string{
	"unprocessed",
	"backlog",
	"in_progress",
	"done",
	"rejected",
}

// statusRank — индекс кода статуса в StatusOrder.
var statusRank = func() map[string]int {
	m := make(map[string]int, len(StatusOrder))
	for i, code := range StatusOrder {
		m[code] = i
	}
	return m
}()

// Direction — направление переключения статуса (back — к предыдущему,
// fwd — к следующему по StatusOrder).
type Direction string

const (
	DirectionBack    Direction = "back"
	DirectionForward Direction = "fwd"
)

// ErrStatusConflict возвращается при гонке: между чтением текущего статуса
// и обновлением значение в БД изменил другой запрос.
var ErrStatusConflict = fmt.Errorf("status changed concurrently")

// UpdateResult — итог переключения статуса: исходное и итоговое значение.
// Специфичные для сущности идентификаторы в него не входят — маршрутный слой
// сам добавляет code/id в ответ.
type UpdateResult struct {
	Field string         `json:"field"`
	From  *CompanyStatus `json:"from"`
	To    *CompanyStatus `json:"to"`
}

// validContentFieldName проверяет имя action-колонки контентных таблиц
// (articles, news, posts).
func validContentFieldName(field string) bool {
	switch field {
	case "action_dev", "action_post", "action_comment", "action_industry", "action_company":
		return true
	}
	return false
}

// validCompanyFieldName проверяет имя action-колонки таблицы companies
// (у компаний доступна только часть полей).
func validCompanyFieldName(field string) bool {
	switch field {
	case "action_industry", "action_company":
		return true
	}
	return false
}

// getStatusTitle возвращает человекочитаемый title статуса из справочника.
func getStatusTitle(ctx context.Context, code string) (string, error) {
	var title string
	err := db.QueryRowContext(ctx,
		"SELECT title FROM statuses WHERE code = ?", code,
	).Scan(&title)
	if err == sql.ErrNoRows {
		return "", fmt.Errorf("status %q not found", code)
	}
	if err != nil {
		return "", err
	}
	return title, nil
}

// readCurrentStatus читает текущее значение action-колонки из заданной таблицы.
// table и field — строго из разрешённых списков, поэтому конкатенация безопасна.
func readCurrentStatus(ctx context.Context, table, field, where string, args ...interface{}) (string, error) {
	var current string
	err := db.QueryRowContext(ctx,
		fmt.Sprintf("SELECT %s FROM %s WHERE %s", field, table, where), args...,
	).Scan(&current)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return current, nil
}

// ValidCompanyStatusField экспортирует проверку имени поля для маршрутного слоя.
func ValidCompanyStatusField(field string) bool { return validCompanyFieldName(field) }

// ValidContentStatusField экспортирует проверку имени поля для маршрутного слоя.
func ValidContentStatusField(field string) bool { return validContentFieldName(field) }

// ValidStatusDirection экспортирует проверку направления для маршрутного слоя.
func ValidStatusDirection(dir Direction) bool {
	return dir == DirectionBack || dir == DirectionForward
}

// applyStatusUpdate вычисляет соседний статус и атомарно обновляет запись.
// Возвращает результат и found == false, если запись не найдена.
// Если текущий статус уже первый («Назад») или последний («Вперёд») в
// StatusOrder, обновление не выполняется и возвращается текущее значение.
func applyStatusUpdate(table, field, where string, dir Direction, args ...interface{}) (*UpdateResult, bool, error) {
	if db == nil {
		return nil, false, fmt.Errorf("database not initialized")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	current, err := readCurrentStatus(ctx, table, field, where, args...)
	if err != nil {
		return nil, false, err
	}
	if current == "" {
		return nil, false, nil
	}

	idx, known := statusRank[current]
	if !known {
		// В БД лежит код вне фиксированного порядка — сдвигать некуда,
		// возвращаем текущий статус без изменений.
		title, terr := getStatusTitle(ctx, current)
		if terr != nil {
			return nil, false, terr
		}
		cur := &CompanyStatus{Code: current, Title: title}
		return &UpdateResult{Field: field, From: cur, To: cur}, true, nil
	}

	targetIdx := idx
	if dir == DirectionBack && idx > 0 {
		targetIdx = idx - 1
	} else if dir == DirectionForward && idx < len(StatusOrder)-1 {
		targetIdx = idx + 1
	}
	next := StatusOrder[targetIdx]

	if next != current {
		// Условное обновление по старому значению: если другой запрос уже
		// изменил статус, RowsAffected == 0 и сообщаем о конфликте.
		updateArgs := make([]interface{}, 0, len(args)+2)
		updateArgs = append(updateArgs, next)
		updateArgs = append(updateArgs, args...)
		updateArgs = append(updateArgs, current)
		res, err := db.ExecContext(ctx,
			fmt.Sprintf("UPDATE %s SET %s = ? WHERE %s AND %s = ?", table, field, where, field),
			updateArgs...,
		)
		if err != nil {
			return nil, false, err
		}
		rows, err := res.RowsAffected()
		if err != nil {
			return nil, false, err
		}
		if rows == 0 {
			return nil, false, ErrStatusConflict
		}
	}

	fromTitle, err := getStatusTitle(ctx, current)
	if err != nil {
		return nil, false, err
	}
	toTitle, err := getStatusTitle(ctx, next)
	if err != nil {
		return nil, false, err
	}

	return &UpdateResult{
		Field: field,
		From:  &CompanyStatus{Code: current, Title: fromTitle},
		To:    &CompanyStatus{Code: next, Title: toTitle},
	}, true, nil
}

// UpdateCompanyStatus переключает action_industry или action_company компании
// на соседний статус в StatusOrder.
func UpdateCompanyStatus(code, field string, dir Direction) (result *UpdateResult, found bool, err error) {
	return applyStatusUpdate("companies", field, "code = ?", dir, code)
}

// UpdateArticleStatus переключает action-поле статьи (таблица articles)
// на соседний статус в StatusOrder.
func UpdateArticleStatus(companyCode string, articleID int64, field string, dir Direction) (*UpdateResult, bool, error) {
	return applyStatusUpdate("articles", field, "company = ? AND id = ?", dir, companyCode, articleID)
}

// UpdateNewsStatus переключает action-поле новости (таблица news)
// на соседний статус в StatusOrder.
func UpdateNewsStatus(companyCode string, newsID int64, field string, dir Direction) (*UpdateResult, bool, error) {
	return applyStatusUpdate("news", field, "company = ? AND id = ?", dir, companyCode, newsID)
}

// UpdatePostStatus переключает action-поле поста (таблица posts)
// на соседний статус в StatusOrder.
func UpdatePostStatus(companyCode string, postID int64, field string, dir Direction) (*UpdateResult, bool, error) {
	return applyStatusUpdate("posts", field, "company = ? AND id = ?", dir, companyCode, postID)
}

