package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"runtime"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// panicHandler всегда паникует заданным значением.
func panicHandler(v interface{}) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		panic(v)
	}
}

// inTempDir запускает f во временной директории, чтобы recover.log писался
// туда, а не в корень проекта.
func inTempDir(t *testing.T, f func()) {
	t.Helper()
	dir := t.TempDir()
	cwd, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(dir))
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	f()
}

// 1. Паника перехватывается: клиент получает 500 + {"error": "internal server error"},
// процесс не падает (тест продолжается после ServeHTTP).
func TestRecoverMiddleware_PanicReturns500(t *testing.T) {
	inTempDir(t, func() {
		req := httptest.NewRequest(http.MethodGet, "/posts/statuses/wirenboard", nil)
		rec := httptest.NewRecorder()
		RecoverMiddleware(panicHandler("boom")).ServeHTTP(rec, req)
		assert.Equal(t, http.StatusInternalServerError, rec.Code)
		var body map[string]string
		require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
		assert.Equal(t, "internal server error", body["error"])
		assert.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	})
}

// 2. Формат записи в recover.log: время, method, path, remote, panic, стектрейс.
func TestRecoverMiddleware_LogFormat(t *testing.T) {
	inTempDir(t, func() {
		req := httptest.NewRequest(http.MethodPost, "/posts/statuses/wirenboard", nil)
		rec := httptest.NewRecorder()
		RecoverMiddleware(panicHandler("boom")).ServeHTTP(rec, req)
		content, err := os.ReadFile("recover.log")
		require.NoError(t, err)
		s := string(content)
		// Дата/время вида 2006-01-02 15:04:05 + маркеры записи.
		assert.Regexp(t, `\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} PANIC RECOVERED method=POST path=/posts/statuses/wirenboard`, s)
		assert.Contains(t, s, "panic=boom")
		assert.Contains(t, s, "goroutine ")
		assert.Contains(t, s, "[running]")
		// Стектрейс должен указывать на RecoverMiddleware/паникующий хендлер.
		assert.Contains(t, s, "RecoverMiddleware")
		// Запись заканчивается переводом строки.
		assert.True(t, strings.HasSuffix(s, "\n"), "log line must end with newline")
	})
}

// 3. Обычный хендлер без паники: проходит вниз по стеку, recover.log не создаётся.
func TestRecoverMiddleware_NoPanic_PassesThrough(t *testing.T) {
	inTempDir(t, func() {
		req := httptest.NewRequest(http.MethodGet, "/company/statuses/otus", nil)
		rec := httptest.NewRecorder()
		RecoverMiddleware(http.HandlerFunc(okHandler)).ServeHTTP(rec, req)
		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Equal(t, "ok", rec.Body.String())
		_, err := os.Stat("recover.log")
		assert.True(t, os.IsNotExist(err), "recover.log must not be created when no panic occurs")
	})
}

// 4. panic(nil) не перехватывается: в Go (>=1.21) паника nil «воскрешается»
// и завершает горутицу молча — recover() возвращает nil, guard rec != nil
// срабатывает корректно (ничего не записывает, ответ не формируется). Проверка:
// мидлвар не падает и не пишет лог при nil-панике (наблюдаемого эффекта нет —
// это задокументированное поведение языка).
func TestRecoverMiddleware_PanicNil_PassesThrough(t *testing.T) {
	inTempDir(t, func() {
		handler := RecoverMiddleware(panicHandler(nil))
		req := httptest.NewRequest(http.MethodGet, "/nil", nil)
		rec := httptest.NewRecorder()
	// Наблюдаемое поведение: panic(nil) не перехватывается middleware (guard
	// rec != nil не срабатывает), 500 не формируется — мидлвар ничего не делает
	// и лог не пишет.
	handler.ServeHTTP(rec, req)
	assert.NotEqual(t, http.StatusInternalServerError, rec.Code, "panic(nil) must not be turned into 500 by the middleware")
	_, err := os.Stat("recover.log")
		assert.True(t, os.IsNotExist(err), "recover.log must not be created for panic(nil)")
	})
}

// 5. Невозможность открыть recover.log (директория только для чтения):
// мидлвар всё Ҁавно возвращает 500 и не падает.
func TestRecoverMiddleware_LogUnwritable_StillReturns500(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("readonly-directory semantics differ on Windows; skipped")
	}
	dir := t.TempDir()
	cwd, err := os.Getwd()
	require.NoError(t, err)
	require.NoError(t, os.Chdir(dir))
	t.Cleanup(func() { _ = os.Chdir(cwd) })
	// Директория только для чтения — создать recover.log невозможно.
	require.NoError(t, os.Chmod(dir, 0o555))
	t.Cleanup(func() { _ = os.Chmod(dir, 0o755) })

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	rec := httptest.NewRecorder()
	RecoverMiddleware(panicHandler("boom")).ServeHTTP(rec, req)
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	var body map[string]string
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	assert.Equal(t, "internal server error", body["error"])
}

// 6. Вложенные RecoverMiddleware: каждая обёртка перехватывает панику своей зоны;
// паника во внутреннем хендлере ловится внешней (первой встретившейся) обёрткой.
func TestRecoverMiddleware_Nested(t *testing.T) {
	inTempDir(t, func() {
		inner := RecoverMiddleware(panicHandler("inner-panic"))
		outer := RecoverMiddleware(inner)
		req := httptest.NewRequest(http.MethodGet, "/nested", nil)
		rec := httptest.NewRecorder()
		outer.ServeHTTP(rec, req)
		assert.Equal(t, http.StatusInternalServerError, rec.Code)
		content, err := os.ReadFile("recover.log")
		require.NoError(t, err)
		assert.Contains(t, string(content), "panic=inner-panic")
		// Паника перехвачена ровно один раз — ровно одна запись в логе.
		assert.Equal(t, 1, strings.Count(string(content), "PANIC RECOVERED"))
	})
}
