package util

import "unicode"

// CapitalizeFirst приводит первую букву строки к заглавному виду.
// Если строка пустая или первый символ не буква — возвращает исходную строку.
func CapitalizeFirst(s string) string {
	if s == "" {
		return s
	}
	// Находим первый буквенный символ.
	for i, r := range s {
		if !unicode.IsLetter(r) {
			continue
		}
		// Преобразуем в заглавную букву
		upper := unicode.ToUpper(r)
		// Строим новую строку: часть до буквы + заглавная буква + остаток после буквы
		return s[:i] + string(upper) + s[i+len(string(r)):]
	}
	return s
}