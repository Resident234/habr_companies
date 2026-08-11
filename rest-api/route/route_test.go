package route

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"testing"
	"unicode/utf8"

	dbop "github.com/Resident234/habr_companies/rest-api/dbOp"
)

func TestValidateCode(t *testing.T) {
	tests := []struct {
		code  string
		valid bool
	}{
		{"yandex", true},
		{"Yandex123", true},
		{"my_company-1", true},
		{"", false},
		{"абв", false},
		{"a b", false},
		{strings.Repeat("a", 256), false},
		{strings.Repeat("a", 255), true},
	}

	for _, tt := range tests {
		if got := validateCode(tt.code); got != tt.valid {
			t.Errorf("code=%q expected valid=%v got valid=%v", tt.code, tt.valid, got)
		}
	}
}

func TestValidateTitle(t *testing.T) {
	tests := []struct {
		title string
		valid bool
	}{
		{"Яндекс", true},
		{"Google LLC", true},
		{"", false},
		{"a", true},
		{strings.Repeat("a", 256), false},
		{strings.Repeat("я", 200), true}, // 200 runes, 400 bytes — must be valid
		{strings.Repeat("я", 255), true},
		{strings.Repeat("я", 256), false},
		{"100% cotton", true},
	}

	for _, tt := range tests {
		title := strings.TrimSpace(tt.title)
		if got := validateTitle(title); got != tt.valid {
			t.Errorf("title=%q runes=%d expected valid=%v got valid=%v",
				tt.title, utf8.RuneCountInString(title), tt.valid, got)
		}
	}
}

func withAPIKey(t *testing.T) {
	t.Helper()
	os.Setenv("COMPANY_API_KEY", "test-key")
	t.Cleanup(func() { os.Unsetenv("COMPANY_API_KEY") })
}

func withUpsert(t *testing.T, fn func(code, title string) (bool, error)) {
	t.Helper()
	old := upsertCompany
	upsertCompany = fn
	t.Cleanup(func() { upsertCompany = old })
}

func doAdd(t *testing.T, code, title, apiKey string) *httptest.ResponseRecorder {
	t.Helper()
	path := fmt.Sprintf("/company/add/%s/%s", url.PathEscape(code), url.PathEscape(title))
	req := httptest.NewRequest(http.MethodPost, path, nil)
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func TestHTTP_CreateCompany(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		if code != "yandex" || title != "Яндекс" {
			t.Errorf("unexpected args code=%q title=%q", code, title)
		}
		return true, nil
	})

	rec := doAdd(t, "yandex", "Яндекс", "test-key")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["code"] != "yandex" || body["title"] != "Яндекс" {
		t.Fatalf("body=%v", body)
	}
}

func TestHTTP_UpdateCompany(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		return false, nil
	})

	rec := doAdd(t, "yandex", "Яндекс", "test-key")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_WrongKey(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		t.Fatal("upsert must not be called")
		return false, nil
	})

	rec := doAdd(t, "yandex", "Яндекс", "wrong-key")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_MissingKey(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		t.Fatal("upsert must not be called")
		return false, nil
	})

	rec := doAdd(t, "yandex", "Яндекс", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_DBError(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		return false, fmt.Errorf("boom")
	})

	rec := doAdd(t, "yandex", "Яндекс", "test-key")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_InvalidCode(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		t.Fatal("upsert must not be called")
		return false, nil
	})

	rec := doAdd(t, "bad code", "Ok", "test-key")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_InvalidTitle(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		t.Fatal("upsert must not be called")
		return false, nil
	})

	rec := doAdd(t, "yandex", "   ", "test-key")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_TitleWithPercent(t *testing.T) {
	withAPIKey(t)
	withUpsert(t, func(code, title string) (bool, error) {
		if title != "100% cotton" {
			t.Errorf("title corrupted by double-decode: %q", title)
		}
		return true, nil
	})

	rec := doAdd(t, "acme", "100% cotton", "test-key")
	if rec.Code != http.StatusCreated {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func withArticleStatuses(t *testing.T, fn func(code string, id int64) (interface{}, bool, error)) {
	t.Helper()
	old := getArticleStatuses
	getArticleStatuses = func(code string, id int64) (*dbopTypesArticleStatuses, bool, error) {
		res, found, err := fn(code, id)
		if res == nil {
			return nil, found, err
		}
		return res.(*dbopTypesArticleStatuses), found, err
	}
	t.Cleanup(func() { getArticleStatuses = old })
}

// dbopTypesArticleStatuses — алиас для типа из dbOp (используется в подмене).
type dbopTypesArticleStatuses = dbop.ArticleStatuses

func doGetArticleStatuses(t *testing.T, code, id, apiKey string, query string) *httptest.ResponseRecorder {
	t.Helper()
	path := fmt.Sprintf("/article/statuses/%s/%s%s", url.PathEscape(code), id, query)
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func newTestArticleStatuses() *dbop.ArticleStatuses {
	return &dbop.ArticleStatuses{
		ID:      1067190,
		Company: "wirenboard",
		ActionDev:      &dbop.CompanyStatus{Code: "in_progress", Title: "В работе"},
		ActionPost:     &dbop.CompanyStatus{Code: "done", Title: "Завершено"},
		ActionComment:  &dbop.CompanyStatus{Code: "backlog", Title: "В бэклоге"},
		ActionIndustry: &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
		ActionCompany:  &dbop.CompanyStatus{Code: "rejected", Title: "Отклонено"},
	}
}

func TestHTTP_ArticleStatuses_OK(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		if code != "wirenboard" || id != 1067190 {
			t.Errorf("unexpected args code=%q id=%d", code, id)
		}
		return newTestArticleStatuses(), true, nil
	})

	rec := doGetArticleStatuses(t, "wirenboard", "1067190", "test-key", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body dbop.ArticleStatuses
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.ID != 1067190 || body.Company != "wirenboard" {
		t.Fatalf("body=%+v", body)
	}
	if body.ActionDev == nil || body.ActionDev.Title != "В работе" {
		t.Fatalf("action_dev=%+v", body.ActionDev)
	}
	if body.ActionCompany == nil || body.ActionCompany.Code != "rejected" {
		t.Fatalf("action_company=%+v", body.ActionCompany)
	}
}

// Query-строка (например ?page=2) не должна ломать маршрут.
func TestHTTP_ArticleStatuses_QueryStringIgnored(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		return newTestArticleStatuses(), true, nil
	})

	rec := doGetArticleStatuses(t, "wirenboard", "1067190", "test-key", "?page=2")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleStatuses_NotFound(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		return nil, false, nil
	})

	rec := doGetArticleStatuses(t, "wirenboard", "999999", "test-key", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleStatuses_InvalidCode(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getArticleStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetArticleStatuses(t, "bad code", "1067190", "test-key", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleStatuses_InvalidID(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getArticleStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetArticleStatuses(t, "wirenboard", "abc", "test-key", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleStatuses_ZeroID(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getArticleStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetArticleStatuses(t, "wirenboard", "0", "test-key", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleStatuses_WrongKey(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getArticleStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetArticleStatuses(t, "wirenboard", "1067190", "wrong-key", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleStatuses_DBError(t *testing.T) {
	withAPIKey(t)
	withArticleStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		return nil, false, fmt.Errorf("boom")
	})

	rec := doGetArticleStatuses(t, "wirenboard", "1067190", "test-key", "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func withNewsStatuses(t *testing.T, fn func(code string, id int64) (interface{}, bool, error)) {
	t.Helper()
	old := getNewsStatuses
	getNewsStatuses = func(code string, id int64) (*dbopTypesNewsStatuses, bool, error) {
		res, found, err := fn(code, id)
		if res == nil {
			return nil, found, err
		}
		return res.(*dbopTypesNewsStatuses), found, err
	}
	t.Cleanup(func() { getNewsStatuses = old })
}

// dbopTypesNewsStatuses — алиас для типа из dbOp (используется в подмене).
type dbopTypesNewsStatuses = dbop.NewsStatuses

func doGetNewsStatuses(t *testing.T, code, id, apiKey string, query string) *httptest.ResponseRecorder {
	t.Helper()
	path := fmt.Sprintf("/news/statuses/%s/%s%s", url.PathEscape(code), id, query)
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func newTestNewsStatuses() *dbop.NewsStatuses {
	return &dbop.NewsStatuses{
		ID:             1067864,
		Company:        "infostart",
		ActionDev:      &dbop.CompanyStatus{Code: "in_progress", Title: "В работе"},
		ActionPost:     &dbop.CompanyStatus{Code: "done", Title: "Завершено"},
		ActionComment:  &dbop.CompanyStatus{Code: "backlog", Title: "В бэклоге"},
		ActionIndustry: &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
		ActionCompany:  &dbop.CompanyStatus{Code: "rejected", Title: "Отклонено"},
	}
}

func TestHTTP_NewsStatuses_OK(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		if code != "infostart" || id != 1067864 {
			t.Errorf("unexpected args code=%q id=%d", code, id)
		}
		return newTestNewsStatuses(), true, nil
	})

	rec := doGetNewsStatuses(t, "infostart", "1067864", "test-key", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body dbop.NewsStatuses
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.ID != 1067864 || body.Company != "infostart" {
		t.Fatalf("body=%+v", body)
	}
	if body.ActionDev == nil || body.ActionDev.Title != "В работе" {
		t.Fatalf("action_dev=%+v", body.ActionDev)
	}
	if body.ActionCompany == nil || body.ActionCompany.Code != "rejected" {
		t.Fatalf("action_company=%+v", body.ActionCompany)
	}
}

// Query-строка (например ?page=2) не должна ломать маршрут.
func TestHTTP_NewsStatuses_QueryStringIgnored(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		return newTestNewsStatuses(), true, nil
	})

	rec := doGetNewsStatuses(t, "infostart", "1067864", "test-key", "?page=2")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_NewsStatuses_NotFound(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		return nil, false, nil
	})

	rec := doGetNewsStatuses(t, "infostart", "999999", "test-key", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_NewsStatuses_InvalidCode(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getNewsStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetNewsStatuses(t, "bad code", "1067864", "test-key", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_NewsStatuses_InvalidID(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getNewsStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetNewsStatuses(t, "infostart", "abc", "test-key", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_NewsStatuses_ZeroID(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getNewsStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetNewsStatuses(t, "infostart", "0", "test-key", "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_NewsStatuses_WrongKey(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		t.Fatal("getNewsStatuses must not be called")
		return nil, false, nil
	})

	rec := doGetNewsStatuses(t, "infostart", "1067864", "wrong-key", "")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_NewsStatuses_DBError(t *testing.T) {
	withAPIKey(t)
	withNewsStatuses(t, func(code string, id int64) (interface{}, bool, error) {
		return nil, false, fmt.Errorf("boom")
	})

	rec := doGetNewsStatuses(t, "infostart", "1067864", "test-key", "")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}
