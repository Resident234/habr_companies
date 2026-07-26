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
