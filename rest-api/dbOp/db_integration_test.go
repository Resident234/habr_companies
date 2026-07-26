//go:build integration

package dbop_test

import (
	"fmt"
	"os"
	"testing"
	"time"

	dbop "github.com/Resident234/habr_companies/rest-api/dbOp"
)

// Запуск: go test -tags=integration ./dbOp/
// Требует DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.
func TestUpsertCompanyIntegration(t *testing.T) {
	if os.Getenv("DB_HOST") == "" || os.Getenv("DB_NAME") == "" {
		t.Skip("DB_HOST/DB_NAME not set")
	}

	if err := dbop.InitDB(); err != nil {
		t.Fatalf("InitDB: %v", err)
	}

	code := fmt.Sprintf("test_%d", time.Now().UnixNano())
	title := "Интеграционный тест"

	created, err := dbop.UpsertCompany(code, title)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if !created {
		t.Fatal("expected created=true on insert")
	}

	created, err = dbop.UpsertCompany(code, title+" 2")
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if created {
		t.Fatal("expected created=false on update")
	}

	created, err = dbop.UpsertCompany(code, title+" 2")
	if err != nil {
		t.Fatalf("noop update: %v", err)
	}
	if created {
		t.Fatal("expected created=false when title unchanged")
	}
}
