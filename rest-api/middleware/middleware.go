package middleware

import (
	"crypto/subtle"
	"encoding/json"
	"net/http"
	"os"
)

// APIKeyAuth проверяет заголовок X-API-Key и возвращает 401 при отсутствии или несовпадении.
func APIKeyAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		expected := os.Getenv("COMPANY_API_KEY")
		if expected == "" {
			respondError(w, http.StatusInternalServerError, "API key not configured")
			return
		}
		key := r.Header.Get("X-API-Key")
		if !secureEqual(key, expected) {
			respondError(w, http.StatusUnauthorized, "Unauthorized")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// secureEqual сравнивает строки через subtle.ConstantTimeCompare.
func secureEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}
