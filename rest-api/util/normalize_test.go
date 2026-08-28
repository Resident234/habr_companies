package util

import (
	"log"
	"strings"
	"testing"
)

func TestNormalizeCategoryTitle(t *testing.T) {
	tests := map[string]string{
		"Информационной безопасности":    "Информационная безопасность",
		"Корпоративной безопасности":     "Корпоративная безопасность",
		"Информационных технологий":      "Информационные технологии",
		"научно-исследовательских работ": "научно-исследовательские работы",
		"интернет-технологий":            "интернет-технологии",
		"онлайн-сервисов":                "онлайн-сервисы",
		"Финтех":                         "Финтех",
	}

	for input, want := range tests {
		if got := NormalizeCategoryTitle(input); got != want {
			t.Errorf("NormalizeCategoryTitle(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestNormalizeCategoryTitleDebugLogging(t *testing.T) {
	t.Setenv("CATEGORY_NORMALIZATION_DEBUG", "1")

	var logs strings.Builder
	oldOutput := log.Writer()
	log.SetOutput(&logs)
	t.Cleanup(func() { log.SetOutput(oldOutput) })

	got := NormalizeCategoryTitle("Информационной безопасности")
	if got != "Информационная безопасность" {
		t.Fatalf("NormalizeCategoryTitle() = %q", got)
	}
	if !strings.Contains(logs.String(), "[category-normalization]") ||
		!strings.Contains(logs.String(), "selected_form=") ||
		!strings.Contains(logs.String(), "result=\"Информационная безопасность\"") {
		t.Fatalf("unexpected normalization log: %s", logs.String())
	}
}
