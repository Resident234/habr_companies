package middleware

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime/debug"
	"time"
)

// RecoverMiddleware перехватывает паники внутри HTTP-хендлеров:
// записывает время, URL, панику и полный стектрейс в recover.log,
// отвечает клиенту 500 и не даёт процессу упасть.
func RecoverMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				stack := debug.Stack()
				line := fmt.Sprintf(
					"%s PANIC RECOVERED method=%s path=%s remote=%s panic=%v\n%s\n",
					time.Now().Format("2006-01-02 15:04:05"),
					r.Method, r.URL.Path, r.RemoteAddr, rec, string(stack),
				)
				// Дублируем в stderr, чтобы паника не потерялась и в журналах.
				log.Print("PANIC RECOVERED: ", rec)
				// Отдельный файл recover.log в рабочей директории процесса.
				// Ошибки открытия/записи лога не должны ронять обработчик.
				if f, err := os.OpenFile("recover.log",
					os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644); err == nil {
					_, _ = f.WriteString(line)
					_ = f.Close()
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusInternalServerError)
				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "internal server error",
				})
			}
		}()
		next.ServeHTTP(w, r)
	})
}
