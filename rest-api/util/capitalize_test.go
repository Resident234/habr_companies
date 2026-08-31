package util

import "testing"

func TestCapitalizeFirst(t *testing.T) {
	tests := map[string]string{
		"sapiens ai":     "Sapiens ai",
		"Sapiens AI":     "Sapiens AI",
		"sAPIENS":        "SAPIENS",
		"":               "",
		"  hello":        "  Hello",
		"123abc":         "123Abc",
		"инициалы":       "Инициалы",
		"IT-отдел":       "IT-отдел",
		"   пробел":       "   Пробел",
	}
	for input, want := range tests {
		got := CapitalizeFirst(input)
		if got != want {
			t.Errorf("CapitalizeFirst(%q) = %q, want %q", input, got, want)
		}
	}
}