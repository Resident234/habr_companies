package middleware

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
)

// rotationTestHandler panics on every request.
func rotationTestHandler(w http.ResponseWriter, r *http.Request) {
	panic("rotation probe")
}

func TestRecover_Rotation_BigLogGetsRotated(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "recover.log")

	// Seed the log file with more than the 5 MB limit.
	f, err := os.Create(path)
	assert.NoError(t, err)
	seed := make([]byte, maxRecoverLogSize+1024)
	_, _ = f.Write(seed)
	_ = f.Close()

	prev := os.Getenv("RECOVER_LOG_PATH")
	_ = os.Setenv("RECOVER_LOG_PATH", path)
	t.Cleanup(func() { _ = os.Setenv("RECOVER_LOG_PATH", prev) })

	req := httptest.NewRequest(http.MethodPost, "/x", nil)
	rec := httptest.NewRecorder()
	RecoverMiddleware(http.HandlerFunc(rotationTestHandler)).ServeHTTP(rec, req)

	backup := path + ".1"
	assert.Equal(t, http.StatusInternalServerError, rec.Code)
	assert.Less(t, recoverLogSize(path), int64(maxRecoverLogSize),
		"new log must start small after rotation")
	assert.Greater(t, recoverLogSize(backup), int64(maxRecoverLogSize),
		"backup must hold the old content")
}
