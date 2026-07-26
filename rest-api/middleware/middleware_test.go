package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func okHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
}

func TestAPIKeyAuth_MissingKey(t *testing.T) {
	os.Setenv("COMPANY_API_KEY", "test-key")
	defer os.Unsetenv("COMPANY_API_KEY")

	req := httptest.NewRequest("POST", "/", nil)
	rec := httptest.NewRecorder()

	APIKeyAuth(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Unauthorized")
}

func TestAPIKeyAuth_WrongKey(t *testing.T) {
	os.Setenv("COMPANY_API_KEY", "test-key")
	defer os.Unsetenv("COMPANY_API_KEY")

	req := httptest.NewRequest("POST", "/", nil)
	req.Header.Set("X-API-Key", "wrong-key")
	rec := httptest.NewRecorder()

	APIKeyAuth(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusUnauthorized, rec.Code)
	assert.Contains(t, rec.Body.String(), "Unauthorized")
}

func TestAPIKeyAuth_ValidKey(t *testing.T) {
	os.Setenv("COMPANY_API_KEY", "test-key")
	defer os.Unsetenv("COMPANY_API_KEY")

	req := httptest.NewRequest("POST", "/", nil)
	req.Header.Set("X-API-Key", "test-key")
	rec := httptest.NewRecorder()

	APIKeyAuth(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusOK, rec.Code)
	assert.Equal(t, "ok", rec.Body.String())
}

func TestAPIKeyAuth_NotConfigured(t *testing.T) {
	os.Unsetenv("COMPANY_API_KEY")

	req := httptest.NewRequest("POST", "/", nil)
	req.Header.Set("X-API-Key", "test-key")
	rec := httptest.NewRecorder()

	APIKeyAuth(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)

	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Contains(t, rec.Body.String(), "API key not configured")
}