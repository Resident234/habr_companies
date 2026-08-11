package route

import (
	"encoding/json"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	dbop "github.com/Resident234/habr_companies/rest-api/dbOp"
	"github.com/Resident234/habr_companies/rest-api/middleware"
	"github.com/gorilla/mux"
)

var codeRegex = regexp.MustCompile(`^[a-zA-Z0-9_\-]+$`)

var idRegex = regexp.MustCompile(`^\d+$`)

// upsertCompany вызывается из обработчика; подменяется в тестах.
var upsertCompany = dbop.UpsertCompany

// getCompanyStatuses вызывается из обработчика; подменяется в тестах.
var getCompanyStatuses = dbop.GetCompanyStatuses

// getArticleStatuses вызывается из обработчика; подменяется в тестах.
var getArticleStatuses = dbop.GetArticleStatuses

// getNewsStatuses вызывается из обработчика; подменяется в тестах.
var getNewsStatuses = dbop.GetNewsStatuses

// getPostsStatuses вызывается из обработчика; подменяется в тестах.
var getPostsStatuses = dbop.GetPostsStatuses

// maxBatchIDs должно совпадать с лимитом в dbOp.GetPostsStatuses.
const maxBatchIDs = 100

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

// getCompanyStatusesHandler обрабатывает GET /company/statuses/{code}.
// Возвращает статусы action_industry и action_company компании
// с человекочитаемыми title из справочника statuses.
func getCompanyStatusesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["code"]

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}

	statuses, found, err := getCompanyStatuses(code)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !found {
		respondError(w, http.StatusNotFound, "company not found")
		return
	}

	respondJSON(w, http.StatusOK, statuses)
}

// getArticleStatusesHandler обрабатывает GET /article/statuses/{companyCode}/{articleId}.
// Возвращает статусы action_dev, action_post, action_comment, action_industry
// и action_company статьи с человекочитаемыми title из справочника statuses.
func getArticleStatusesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["companyCode"]
	idStr := vars["articleId"]

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid company code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}

	if !idRegex.MatchString(idStr) {
		respondError(w, http.StatusBadRequest, "invalid article id: must be a positive integer")
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		respondError(w, http.StatusBadRequest, "invalid article id: must be a positive integer")
		return
	}

	statuses, found, err := getArticleStatuses(code, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !found {
		respondError(w, http.StatusNotFound, "article not found")
		return
	}

	respondJSON(w, http.StatusOK, statuses)
}

// getNewsStatusesHandler обрабатывает GET /news/statuses/{companyCode}/{newsId}.
// Возвращает статусы action_dev, action_post, action_comment, action_industry
// и action_company новости с человекочитаемыми title из справочника statuses.
func getNewsStatusesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["companyCode"]
	idStr := vars["newsId"]

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid company code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}

	if !idRegex.MatchString(idStr) {
		respondError(w, http.StatusBadRequest, "invalid news id: must be a positive integer")
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		respondError(w, http.StatusBadRequest, "invalid news id: must be a positive integer")
		return
	}

	statuses, found, err := getNewsStatuses(code, id)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !found {
		respondError(w, http.StatusNotFound, "news not found")
		return
	}

	respondJSON(w, http.StatusOK, statuses)
}

// getPostsStatusesHandler обрабатывает GET /posts/statuses/{companyCode}?ids=1,2,3.
// Возвращает статусы action_dev, action_post, action_comment, action_industry
// и action_company для каждого найденного поста с человекочитаемыми title
// из справочника statuses. Ненайденные посты просто не включаются в ответ.
func getPostsStatusesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["companyCode"]

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid company code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}

	rawIDs := strings.TrimSpace(r.URL.Query().Get("ids"))
	if rawIDs == "" {
		respondError(w, http.StatusBadRequest, "missing ids: provide comma-separated post ids in query parameter 'ids'")
		return
	}

	parts := strings.Split(rawIDs, ",")
	if len(parts) > maxBatchIDs {
		respondError(w, http.StatusBadRequest, "too many ids: max 100 per request")
		return
	}

	ids := make([]int64, 0, len(parts))
	seen := make(map[int64]struct{}, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if !idRegex.MatchString(part) {
			respondError(w, http.StatusBadRequest, "invalid post id: must be a positive integer")
			return
		}
		id, err := strconv.ParseInt(part, 10, 64)
		if err != nil || id <= 0 {
			respondError(w, http.StatusBadRequest, "invalid post id: must be a positive integer")
			return
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}

	if len(ids) == 0 {
		respondError(w, http.StatusBadRequest, "missing ids: provide comma-separated post ids in query parameter 'ids'")
		return
	}

	statuses, err := getPostsStatuses(code, ids)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	respondJSON(w, http.StatusOK, statuses)
}

// NewRouter настраивает маршруты (удобно для HTTP-тестов и запуска из operate).
func NewRouter() http.Handler {
	r := mux.NewRouter()
	r.Handle("/company/add/{code}/{title}", middleware.APIKeyAuth(http.HandlerFunc(addCompany))).Methods("POST")
	r.Handle("/company/statuses/{code}", middleware.APIKeyAuth(http.HandlerFunc(getCompanyStatusesHandler))).Methods("GET")
	r.Handle("/article/statuses/{companyCode}/{articleId}", middleware.APIKeyAuth(http.HandlerFunc(getArticleStatusesHandler))).Methods("GET")
	r.Handle("/news/statuses/{companyCode}/{newsId}", middleware.APIKeyAuth(http.HandlerFunc(getNewsStatusesHandler))).Methods("GET")
	r.Handle("/posts/statuses/{companyCode}", middleware.APIKeyAuth(http.HandlerFunc(getPostsStatusesHandler))).Methods("GET")
	return r
}
