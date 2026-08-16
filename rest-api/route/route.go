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
	"github.com/Resident234/habr_companies/rest-api/util"
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

// updateCompanyStatus вызывается из обработчика; подменяется в тестах.
var updateCompanyStatus = dbop.UpdateCompanyStatus

// updateArticleStatus вызывается из обработчика; подменяется в тестах.
var updateArticleStatus = dbop.UpdateArticleStatus

// updateNewsStatus вызывается из обработчика; подменяется в тестах.
var updateNewsStatus = dbop.UpdateNewsStatus

// updatePostStatus вызывается из обработчика; подменяется в тестах.
var updatePostStatus = dbop.UpdatePostStatus

// maxBatchIDs должно совпадать с лимитом в dbOp.GetPostsStatuses.
const maxBatchIDs = 100
// maxRequestBody ограничивает размер тела JSON-запросов (защита от DoS).
const maxRequestBody = 1 << 20 // 1 MB

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

// parseOptionalPostID парсит необязательный id (для компании его нет).
// Возвращает 0, если idStr пуст.
func parseOptionalPostID(w http.ResponseWriter, idStr, entityLabel string) (int64, bool) {
	if idStr == "" {
		return 0, true
	}
	if !idRegex.MatchString(idStr) {
		respondError(w, http.StatusBadRequest, "invalid "+entityLabel+" id: must be a positive integer")
		return 0, false
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil || id <= 0 {
		respondError(w, http.StatusBadRequest, "invalid "+entityLabel+" id: must be a positive integer")
		return 0, false
	}
	return id, true
}

// statusUpdateFunc — тип функции обновления статуса в нужной таблице.
type statusUpdateFunc func(code string, id int64, field string, dir dbop.Direction) (*dbop.UpdateResult, bool, error)

// updateCompanyStatusHandler обрабатывает PATCH /company/statuses/{code}/{field}/{direction}.
// Переключает action_industry или action_company компании на соседний статус.
func updateCompanyStatusHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	code := vars["code"]
	field := vars["field"]
	dir := dbop.Direction(vars["direction"])

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}
	if !dbop.ValidCompanyStatusField(field) {
		respondError(w, http.StatusBadRequest, "invalid field: allowed action_industry, action_company")
		return
	}
	if !dbop.ValidStatusDirection(dir) {
		respondError(w, http.StatusBadRequest, "invalid direction: allowed back, fwd")
		return
	}

	result, found, err := updateCompanyStatus(code, field, dir)
	if err == dbop.ErrStatusConflict {
		respondError(w, http.StatusConflict, "status changed concurrently, retry")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !found {
		respondError(w, http.StatusNotFound, "company not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"code":  code,
		"field": result.Field,
		"from":  result.From,
		"to":    result.To,
	})
}

// updateContentStatus — общая логика PATCH-эндпоинтов статьи, новости и поста.
func updateContentStatus(w http.ResponseWriter, r *http.Request,
	companyVar, idVar, entityLabel string,
	update statusUpdateFunc) {

	vars := mux.Vars(r)
	code := vars[companyVar]
	idStr := vars[idVar]
	field := vars["field"]
	dir := dbop.Direction(vars["direction"])

	if !validateCode(code) {
		respondError(w, http.StatusBadRequest, "invalid company code: must be 1-255 chars, only latin letters, digits, _, -")
		return
	}
	id, ok := parseOptionalPostID(w, idStr, entityLabel)
	if !ok {
		return
	}
	if !dbop.ValidContentStatusField(field) {
		respondError(w, http.StatusBadRequest, "invalid field: allowed action_dev, action_post, action_comment, action_industry, action_company")
		return
	}
	if !dbop.ValidStatusDirection(dir) {
		respondError(w, http.StatusBadRequest, "invalid direction: allowed back, fwd")
		return
	}

	result, found, err := update(code, id, field, dir)
	if err == dbop.ErrStatusConflict {
		respondError(w, http.StatusConflict, "status changed concurrently, retry")
		return
	}
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}
	if !found {
		respondError(w, http.StatusNotFound, entityLabel+" not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"company": code,
		"field":   result.Field,
		"from":    result.From,
		"to":      result.To,
	})
}

// updateArticleStatusHandler обрабатывает PATCH /article/statuses/{companyCode}/{articleId}/{field}/{direction}.
func updateArticleStatusHandler(w http.ResponseWriter, r *http.Request) {
	updateContentStatus(w, r, "companyCode", "articleId", "article", updateArticleStatus)
}

// updateNewsStatusHandler обрабатывает PATCH /news/statuses/{companyCode}/{newsId}/{field}/{direction}.
func updateNewsStatusHandler(w http.ResponseWriter, r *http.Request) {
	updateContentStatus(w, r, "companyCode", "newsId", "news", updateNewsStatus)
}

// updatePostStatusHandler обрабатывает PATCH /post/statuses/{companyCode}/{postId}/{field}/{direction}.
func updatePostStatusHandler(w http.ResponseWriter, r *http.Request) {
	updateContentStatus(w, r, "companyCode", "postId", "post", updatePostStatus)
}

// quickAddCompany обрабатывает POST /company/quick-add.
// Принимает {"title": "..."}, транслитерирует title в code и сохраняет компанию.
type quickAddRequest struct {
	Title string `json:"title"`
}

func quickAddCompany(w http.ResponseWriter, r *http.Request) {
	var req quickAddRequest
	if err := json.NewDecoder(http.MaxBytesReader(w,r.Body,maxRequestBody)).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	title := strings.TrimSpace(req.Title)
	if !validateTitle(title) {
		respondError(w, http.StatusBadRequest, "invalid title: must be 1-255 chars")
		return
	}

	code := util.Transliterate(title)
	if code == "" {
		respondError(w, http.StatusBadRequest, "could not generate code from title")
		return
	}

	created, err := upsertCompany(code, title)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if created {
		respondJSON(w, http.StatusCreated, map[string]interface{}{"code": code, "title": title})
	} else {
		respondJSON(w, http.StatusOK, map[string]interface{}{"code": code, "title": title})
	}
}

// quickAddCategory обрабатывает POST /category/quick-add.
// Принимает {"title": "..."}, транслитерирует title в code и сохраняет отрасль.
var upsertCategory = dbop.UpsertCategory

func quickAddCategory(w http.ResponseWriter, r *http.Request) {
	var req quickAddRequest
	if err := json.NewDecoder(http.MaxBytesReader(w,r.Body,maxRequestBody)).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	title := strings.TrimSpace(req.Title)
	if !validateTitle(title) {
		respondError(w, http.StatusBadRequest, "invalid title: must be 1-255 chars")
		return
	}

	code := util.Transliterate(title)
	if code == "" {
		respondError(w, http.StatusBadRequest, "could not generate code from title")
		return
	}

	created, err := upsertCategory(code, title)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if created {
		respondJSON(w, http.StatusCreated, map[string]interface{}{"code": code, "title": title})
	} else {
		respondJSON(w, http.StatusOK, map[string]interface{}{"code": code, "title": title})
	}
}

// CommentAddRequest — структура запроса для добавления закладки комментария.
type CommentAddRequest struct {
	Text        string `json:"text"`
	EntityCode  string `json:"entity_code"`
	EntityID    int64  `json:"entity_id"`
	CommentID   int64  `json:"comment_id"`
}

// upsertComment вызывается из обработчика; подменяется в тестах.
var upsertComment = dbop.UpsertComment

// deleteComment вызывается из обработчика; подменяется в тестах.
var deleteComment = dbop.DeleteComment

// addCommentHandler обрабатывает POST /comment/add.
// Принимает JSON: {"text": "...", "entity_code": "posts", "entity_id": 1064400, "comment_id": 29901582}
func addCommentHandler(w http.ResponseWriter, r *http.Request) {
	var req CommentAddRequest
	if err := json.NewDecoder(http.MaxBytesReader(w,r.Body,maxRequestBody)).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		respondError(w, http.StatusBadRequest, "text is required")
		return
	}

	// Validate entity_code
	validEntities := map[string]bool{"news": true, "articles": true, "posts": true}
	if !validEntities[req.EntityCode] {
		respondError(w, http.StatusBadRequest, "invalid entity_code: must be one of news, articles, posts")
		return
	}

	if req.EntityID <= 0 {
		respondError(w, http.StatusBadRequest, "entity_id must be positive")
		return
	}

	if req.CommentID <= 0 {
		respondError(w, http.StatusBadRequest, "comment_id must be positive")
		return
	}

	created, err := upsertComment(req.Text, req.EntityCode, req.EntityID, req.CommentID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if created {
		respondJSON(w, http.StatusCreated, map[string]interface{}{
			"text":         req.Text,
			"entity_code":  req.EntityCode,
			"entity_id":    req.EntityID,
			"comment_id":   req.CommentID,
		})
	} else {
		respondJSON(w, http.StatusOK, map[string]interface{}{
			"text":         req.Text,
			"entity_code":  req.EntityCode,
			"entity_id":    req.EntityID,
			"comment_id":   req.CommentID,
		})
	}
}

// deleteCommentHandler обрабатывает DELETE /comment/{commentId}.
func deleteCommentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	commentIDStr := vars["commentId"]

	commentID, err := strconv.ParseInt(commentIDStr, 10, 64)
	if err != nil || commentID <= 0 {
		respondError(w, http.StatusBadRequest, "invalid comment_id")
		return
	}

	deleted, err := deleteComment(commentID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "database error")
		return
	}

	if !deleted {
		respondError(w, http.StatusNotFound, "comment not found")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"deleted": true,
		"comment_id": commentID,
	})
}

// NewRouter настраивает маршруты (удобно для HTTP-тестов и запуска из operate).
func NewRouter() http.Handler {
	r := mux.NewRouter()
	r.Handle("/company/add/{code}/{title}", middleware.APIKeyAuth(http.HandlerFunc(addCompany))).Methods("POST")
	r.Handle("/company/statuses/{code}", middleware.APIKeyAuth(http.HandlerFunc(getCompanyStatusesHandler))).Methods("GET")
	r.Handle("/article/statuses/{companyCode}/{articleId}", middleware.APIKeyAuth(http.HandlerFunc(getArticleStatusesHandler))).Methods("GET")
	r.Handle("/news/statuses/{companyCode}/{newsId}", middleware.APIKeyAuth(http.HandlerFunc(getNewsStatusesHandler))).Methods("GET")
	r.Handle("/posts/statuses/{companyCode}", middleware.APIKeyAuth(http.HandlerFunc(getPostsStatusesHandler))).Methods("GET")
	r.Handle("/company/statuses/{code}/{field}/{direction}", middleware.APIKeyAuth(http.HandlerFunc(updateCompanyStatusHandler))).Methods("PATCH")
	r.Handle("/article/statuses/{companyCode}/{articleId}/{field}/{direction}", middleware.APIKeyAuth(http.HandlerFunc(updateArticleStatusHandler))).Methods("PATCH")
	r.Handle("/news/statuses/{companyCode}/{newsId}/{field}/{direction}", middleware.APIKeyAuth(http.HandlerFunc(updateNewsStatusHandler))).Methods("PATCH")
	r.Handle("/post/statuses/{companyCode}/{postId}/{field}/{direction}", middleware.APIKeyAuth(http.HandlerFunc(updatePostStatusHandler))).Methods("PATCH")
	r.Handle("/company/quick-add", middleware.APIKeyAuth(http.HandlerFunc(quickAddCompany))).Methods("POST")
	r.Handle("/category/quick-add", middleware.APIKeyAuth(http.HandlerFunc(quickAddCategory))).Methods("POST")
	// Comment bookmark routes
	r.Handle("/comment/add", middleware.APIKeyAuth(http.HandlerFunc(addCommentHandler))).Methods("POST")
	r.Handle("/comment/{commentId}", middleware.APIKeyAuth(http.HandlerFunc(deleteCommentHandler))).Methods("DELETE")
	return middleware.RecoverMiddleware(r)
}
