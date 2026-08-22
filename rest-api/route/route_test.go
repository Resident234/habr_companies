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
		ID:             1067190,
		Company:        "wirenboard",
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

// === /posts/statuses/{companyCode}?ids=... ===

func withPostsStatuses(t *testing.T, fn func(code string, ids []int64) (*dbop.PostsStatuses, error)) {
	t.Helper()
	old := getPostsStatuses
	getPostsStatuses = fn
	t.Cleanup(func() { getPostsStatuses = old })
}

func doGetPostsStatuses(t *testing.T, code, query, apiKey string) *httptest.ResponseRecorder {
	t.Helper()
	path := fmt.Sprintf("/posts/statuses/%s%s", url.PathEscape(code), query)
	req := httptest.NewRequest(http.MethodGet, path, nil)
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func newTestPostsStatuses() *dbop.PostsStatuses {
	return &dbop.PostsStatuses{
		Company: "k2tech",
		Posts: []*dbop.PostStatuses{
			{
				ID:             1044134,
				Company:        "k2tech",
				ActionDev:      &dbop.CompanyStatus{Code: "in_progress", Title: "В работе"},
				ActionPost:     &dbop.CompanyStatus{Code: "done", Title: "Завершено"},
				ActionComment:  &dbop.CompanyStatus{Code: "backlog", Title: "В бэклоге"},
				ActionIndustry: &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
				ActionCompany:  &dbop.CompanyStatus{Code: "rejected", Title: "Отклонено"},
			},
			{
				ID:             1044135,
				Company:        "k2tech",
				ActionDev:      &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
				ActionPost:     &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
				ActionComment:  &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
				ActionIndustry: &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
				ActionCompany:  &dbop.CompanyStatus{Code: "unprocessed", Title: "Не обработано"},
			},
		},
	}
}

func TestHTTP_PostsStatuses_OK(t *testing.T) {
	withAPIKey(t)
	withPostsStatuses(t, func(code string, ids []int64) (*dbop.PostsStatuses, error) {
		if code != "k2tech" {
			t.Errorf("unexpected code=%q", code)
		}
		if len(ids) != 2 || ids[0] != 1044134 || ids[1] != 1044135 {
			t.Errorf("unexpected ids=%v", ids)
		}
		return newTestPostsStatuses(), nil
	})

	rec := doGetPostsStatuses(t, "k2tech", "?ids=1044134,1044135", "test-key")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}

	var body dbop.PostsStatuses
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Company != "k2tech" {
		t.Fatalf("company=%q", body.Company)
	}
	if len(body.Posts) != 2 {
		t.Fatalf("posts count=%d", len(body.Posts))
	}
	if body.Posts[0].ID != 1044134 {
		t.Fatalf("first post id=%d", body.Posts[0].ID)
	}
	if body.Posts[0].ActionDev == nil || body.Posts[0].ActionDev.Title != "В работе" {
		t.Fatalf("action_dev=%+v", body.Posts[0].ActionDev)
	}
	if body.Posts[0].ActionCompany == nil || body.Posts[0].ActionCompany.Code != "rejected" {
		t.Fatalf("action_company=%+v", body.Posts[0].ActionCompany)
	}
}

func TestHTTP_PostsStatuses_DuplicateIDsAreDeduplicated(t *testing.T) {
	withAPIKey(t)
	withPostsStatuses(t, func(code string, ids []int64) (*dbop.PostsStatuses, error) {
		if len(ids) != 2 {
			t.Errorf("expected 2 unique ids, got %v", ids)
		}
		return newTestPostsStatuses(), nil
	})

	rec := doGetPostsStatuses(t, "k2tech", "?ids=1044134,1044134,1044135,", "test-key")
	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_PostsStatuses_ValidationErrors(t *testing.T) {
	withAPIKey(t)
	withPostsStatuses(t, func(code string, ids []int64) (*dbop.PostsStatuses, error) {
		t.Fatal("getPostsStatuses must not be called")
		return nil, nil
	})

	cases := []struct{ code, query, key string }{
		{"bad code", "?ids=1044134", "test-key"},
		{"k2tech", "", "test-key"},
		{"k2tech", "?ids=abc", "test-key"},
		{"k2tech", "?ids=1044134,0", "test-key"},
		{"k2tech", "?ids=-5", "test-key"},
	}
	for _, c := range cases {
		rec := doGetPostsStatuses(t, c.code, c.query, c.key)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("code=%q query=%q status=%d body=%s", c.code, c.query, rec.Code, rec.Body.String())
		}
	}
}

func TestHTTP_PostsStatuses_TooManyIDs(t *testing.T) {
	withAPIKey(t)
	withPostsStatuses(t, func(code string, ids []int64) (*dbop.PostsStatuses, error) {
		t.Fatal("getPostsStatuses must not be called")
		return nil, nil
	})

	parts := make([]string, 0, 101)
	for i := 1; i <= 101; i++ {
		parts = append(parts, fmt.Sprintf("%d", i))
	}
	rec := doGetPostsStatuses(t, "k2tech", "?ids="+strings.Join(parts, ","), "test-key")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_PostsStatuses_WrongKey(t *testing.T) {
	withAPIKey(t)
	withPostsStatuses(t, func(code string, ids []int64) (*dbop.PostsStatuses, error) {
		t.Fatal("getPostsStatuses must not be called")
		return nil, nil
	})

	rec := doGetPostsStatuses(t, "k2tech", "?ids=1044134", "wrong-key")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_PostsStatuses_DBError(t *testing.T) {
	withAPIKey(t)
	withPostsStatuses(t, func(code string, ids []int64) (*dbop.PostsStatuses, error) {
		return nil, fmt.Errorf("boom")
	})

	rec := doGetPostsStatuses(t, "k2tech", "?ids=1044134", "test-key")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

// === PATCH /{entity}/statuses/... ===

func withCompanyStatusUpdate(t *testing.T, fn func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error)) {
	t.Helper()
	old := updateCompanyStatus
	updateCompanyStatus = fn
	t.Cleanup(func() { updateCompanyStatus = old })
}

func withArticleStatusUpdate(t *testing.T, fn func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error)) {
	t.Helper()
	old := updateArticleStatus
	updateArticleStatus = fn
	t.Cleanup(func() { updateArticleStatus = old })
}

func withNewsStatusUpdate(t *testing.T, fn func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error)) {
	t.Helper()
	old := updateNewsStatus
	updateNewsStatus = fn
	t.Cleanup(func() { updateNewsStatus = old })
}

func withPostStatusUpdate(t *testing.T, fn func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error)) {
	t.Helper()
	old := updatePostStatus
	updatePostStatus = fn
	t.Cleanup(func() { updatePostStatus = old })
}

func doPatch(t *testing.T, path, apiKey string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPatch, path, nil)
	if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)
	return rec
}

func newTestUpdateResult(field string) *dbop.UpdateResult {
	return &dbop.UpdateResult{
		Field: field,
		From:  &dbop.CompanyStatus{Code: "backlog", Title: "В бэклоге"},
		To:    &dbop.CompanyStatus{Code: "in_progress", Title: "В работе"},
	}
}

func TestHTTP_UpdateCompanyStatus_OK(t *testing.T) {
	withAPIKey(t)
	withCompanyStatusUpdate(t, func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		if code != "yandex" || field != "action_company" || dir != dbop.DirectionForward {
			t.Errorf("unexpected args code=%q field=%q dir=%q", code, field, dir)
		}
		return newTestUpdateResult(field), true, nil
	})

	rec := doPatch(t, "/company/statuses/yandex/action_company/fwd", "test-key")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		Code  string `json:"code"`
		Field string `json:"field"`
		To    struct {
			Code string `json:"code"`
		} `json:"to"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.Code != "yandex" || body.Field != "action_company" || body.To.Code != "in_progress" {
		t.Fatalf("body=%+v", body)
	}
}

func TestHTTP_UpdateCompanyStatus_ValidationErrors(t *testing.T) {
	withAPIKey(t)
	withCompanyStatusUpdate(t, func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		t.Fatal("updateCompanyStatus must not be called")
		return nil, false, nil
	})

	cases := []string{
		"/company/statuses/bad%20code/action_company/fwd", // невалидный code
		"/company/statuses/yandex/action_dev/fwd",         // поле недопустимо для компании
		"/company/statuses/yandex/action_company/up",      // невалидное направление
		"/company/statuses/yandex/unknown_field/fwd",      // неизвестное поле
	}
	for _, path := range cases {
		rec := doPatch(t, path, "test-key")
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("path=%q status=%d body=%s", path, rec.Code, rec.Body.String())
		}
	}
}

func TestHTTP_UpdateCompanyStatus_NotFound(t *testing.T) {
	withAPIKey(t)
	withCompanyStatusUpdate(t, func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		return nil, false, nil
	})

	rec := doPatch(t, "/company/statuses/unknown/action_company/back", "test-key")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_UpdateCompanyStatus_Conflict(t *testing.T) {
	withAPIKey(t)
	withCompanyStatusUpdate(t, func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		return nil, false, dbop.ErrStatusConflict
	})

	rec := doPatch(t, "/company/statuses/yandex/action_company/fwd", "test-key")
	if rec.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_UpdateCompanyStatus_DBError(t *testing.T) {
	withAPIKey(t)
	withCompanyStatusUpdate(t, func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		return nil, false, fmt.Errorf("boom")
	})

	rec := doPatch(t, "/company/statuses/yandex/action_company/fwd", "test-key")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_UpdateCompanyStatus_WrongKey(t *testing.T) {
	withAPIKey(t)
	withCompanyStatusUpdate(t, func(code, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		t.Fatal("updateCompanyStatus must not be called")
		return nil, false, nil
	})

	rec := doPatch(t, "/company/statuses/yandex/action_company/fwd", "wrong-key")
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_UpdateArticleStatus_OK(t *testing.T) {
	withAPIKey(t)
	withArticleStatusUpdate(t, func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		if code != "wirenboard" || id != 1067190 || field != "action_post" || dir != dbop.DirectionBack {
			t.Errorf("unexpected args code=%q id=%d field=%q dir=%q", code, id, field, dir)
		}
		return newTestUpdateResult(field), true, nil
	})

	rec := doPatch(t, "/article/statuses/wirenboard/1067190/action_post/back", "test-key")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		ID      int64  `json:"id"`
		Company string `json:"company"`
		To      struct {
			Code string `json:"code"`
		} `json:"to"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.ID != 1067190 || body.Company != "wirenboard" || body.To.Code != "in_progress" {
		t.Fatalf("body=%+v", body)
	}
}

func TestHTTP_UpdateArticleStatus_ValidationErrors(t *testing.T) {
	withAPIKey(t)
	withArticleStatusUpdate(t, func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		t.Fatal("updateArticleStatus must not be called")
		return nil, false, nil
	})

	cases := []string{
		"/article/statuses/bad%20code/1067190/action_post/fwd",
		"/article/statuses/wirenboard/abc/action_post/fwd",
		"/article/statuses/wirenboard/0/action_post/fwd",
		"/article/statuses/wirenboard/1067190/unknown/fwd",
		"/article/statuses/wirenboard/1067190/action_post/skip",
	}
	for _, path := range cases {
		rec := doPatch(t, path, "test-key")
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("path=%q status=%d body=%s", path, rec.Code, rec.Body.String())
		}
	}
}

func TestHTTP_UpdateNewsStatus_OK(t *testing.T) {
	withAPIKey(t)
	withNewsStatusUpdate(t, func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		if code != "infostart" || id != 1067864 || field != "action_dev" || dir != dbop.DirectionForward {
			t.Errorf("unexpected args code=%q id=%d field=%q dir=%q", code, id, field, dir)
		}
		return newTestUpdateResult(field), true, nil
	})

	rec := doPatch(t, "/news/statuses/infostart/1067864/action_dev/fwd", "test-key")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_UpdatePostStatus_OK(t *testing.T) {
	withAPIKey(t)
	withPostStatusUpdate(t, func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		if code != "k2tech" || id != 1044134 || field != "action_comment" || dir != dbop.DirectionBack {
			t.Errorf("unexpected args code=%q id=%d field=%q dir=%q", code, id, field, dir)
		}
		return newTestUpdateResult(field), true, nil
	})

	rec := doPatch(t, "/post/statuses/k2tech/1044134/action_comment/back", "test-key")
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	var body struct {
		ID      int64  `json:"id"`
		Company string `json:"company"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body.ID != 1044134 || body.Company != "k2tech" {
		t.Fatalf("body=%+v", body)
	}
}

func TestHTTP_UpdatePostStatus_NotFound(t *testing.T) {
	withAPIKey(t)
	withPostStatusUpdate(t, func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error) {
		return nil, false, nil
	})

	rec := doPatch(t, "/post/statuses/k2tech/999/action_post/fwd", "test-key")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTP_ArticleCommentUpsertsArticleBeforeComment(t *testing.T) {
	withAPIKey(t)

	var calls []string
	oldArticle := upsertArticle
	oldComment := upsertComment
	t.Cleanup(func() {
		upsertArticle = oldArticle
		upsertComment = oldComment
	})
	upsertArticle = func(articleID int64, title, companyCode string) (bool, error) {
		calls = append(calls, fmt.Sprintf("article:%d:%s:%s", articleID, title, companyCode))
		return true, nil
	}
	upsertComment = func(text, entityCode string, entityID, commentID int64) (bool, error) {
		calls = append(calls, fmt.Sprintf("comment:%s:%s:%d:%d", text, entityCode, entityID, commentID))
		return true, nil
	}

	body := strings.NewReader(`{"text":"Комментарий","entity_code":"articles","entity_id":663790,"comment_id":29901582,"company_code":"timeweb","article_title":"Как появилась Луна, и что из этого вышло"}`)
	req := httptest.NewRequest(http.MethodPost, "/comment/add", body)
	req.Header.Set("X-API-Key", "test-key")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rec.Code, rec.Body.String())
	}
	want := []string{
		"article:663790:Как появилась Луна, и что из этого вышло:timeweb",
		"comment:Комментарий:articles:663790:29901582",
	}
	if fmt.Sprint(calls) != fmt.Sprint(want) {
		t.Fatalf("unexpected call order or arguments: got %v, want %v", calls, want)
	}
}

func TestHTTP_ArticleCommentRequiresMetadata(t *testing.T) {
	withAPIKey(t)

	oldArticle := upsertArticle
	t.Cleanup(func() { upsertArticle = oldArticle })
	called := false
	upsertArticle = func(articleID int64, title, companyCode string) (bool, error) {
		called = true
		return true, nil
	}

	body := strings.NewReader(`{"text":"Комментарий","entity_code":"articles","entity_id":663790,"comment_id":29901582}`)
	req := httptest.NewRequest(http.MethodPost, "/comment/add", body)
	req.Header.Set("X-API-Key", "test-key")
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	NewRouter().ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rec.Code, rec.Body.String())
	}
	if called {
		t.Fatal("article upsert must not be called for invalid metadata")
	}
}
