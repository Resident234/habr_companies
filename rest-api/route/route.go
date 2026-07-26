package route

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/gorilla/mux"
	dbop "github.com/Resident234/habr_companies/rest-api/dbOp"
	"github.com/Resident234/habr_companies/rest-api/middleware"
)

var codeRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-]+$`)

// upsertCompany вызывается из обработчика; подменяется в тестах.
var upsertCompany = dbop.UpsertCompany

func validateCode(code string) bool {
	return len(code) > 0 && len(code) <= 255 && codeRegex.MatchString(code)
}

func validateTitle(title string) bool {
	n := utf8.RuneCountInString(title)
	return n > 0 && n <= 255
}

func respondJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

func respondError(w http.ResponseWriter, code int, message string) {
	respondJSON(w, code, map[string]string{"error": message})
}

// addCompany обрабатывает POST /company/add/{code}/{title}.
// Gorilla Mux уже декодирует path-параметры; повторный unescape не нужен
// (иначе «100% cotton» превратится в «100 cotton»).
func addCompany(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["code"]
	title := strings.TrimSpace(vars["title"])

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}

	if !validateTitle(title) {
		respondError(w, http.StatusBadRequest, "invalid title: must be 1-255 chars")
		return
	}

	created, err := upsertCompany(code, title)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if created {
		respondJSON(w, http.StatusCreated, map[string]interface{}{
			"code":  code,
			"title": title,
		})
	} else {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"code":  code,
			"title": title,
		})
	}
}

// NewRouter настраивает маршруты (удобно для HTTP-тестов и запуска из operate).
func NewRouter() http.Handler {
	r := mux.NewRouter()
	r.Handle("/company/add/{code}/{title}", middleware.APIKeyAuth(http.HandlerFunc(addCompany))).Methods("POST")
	return r
}
