package util

import (
	"log"
	"os"
	"strings"
	"sync"

	morph "github.com/jus1d/gomorphy"
)

var (
	categoryAnalyzerOnce sync.Once
	categoryAnalyzer     *morph.Analyzer
)

// NormalizeCategoryTitle приводит название отрасли к именительному падежу,
// сохраняя число исходной фразы и согласование определений с существительным.
// При невозможности морфологического разбора возвращает исходное название.
func NormalizeCategoryTitle(title string) string {
	debug := categoryNormalizationDebugEnabled()
	words := strings.Fields(title)
	if len(words) == 0 {
		categoryNormalizationLog(debug, "input=%q result=%q reason=empty", title, "")
		return ""
	}

	analyzer := getCategoryAnalyzer()
	if analyzer == nil {
		categoryNormalizationLog(debug, "input=%q result=%q reason=analyzer_unavailable", title, title)
		return title
	}

	headIndex, number, ok := findCategoryHead(analyzer, words)
	if !ok {
		categoryNormalizationLog(debug, "input=%q result=%q reason=head_not_found", title, title)
		return title
	}

	if len(words) == 1 && strings.Contains(words[0], "-") {
		return normalizeHyphenatedNoun(analyzer, title, words[0], number, debug)
	}

	forms := analyzer.PhraseFormsConcordant(title)
	if result, formIndex, ok := selectNominativePhraseForm(analyzer, forms, headIndex, number); ok {
		categoryNormalizationLog(debug, "input=%q head=%q head_index=%d number=%s forms=%d selected_form=%d result=%q", title, words[headIndex], headIndex, number, len(forms), formIndex, result)
		return result
	}

	categoryNormalizationLog(debug, "input=%q head=%q head_index=%d number=%s forms=%d reason=form_not_found result=%q", title, words[headIndex], headIndex, number, len(forms), title)
	return title
}

func selectNominativePhraseForm(analyzer *morph.Analyzer, forms []string, headIndex int, number string) (string, int, bool) {
	// Prefer the head word's explicit tag. This avoids depending on the
	// number or order of forms returned by PhraseFormsConcordant.
	for formIndex, form := range forms {
		words := strings.Fields(form)
		if headIndex >= len(words) {
			continue
		}
		headTag := analyzer.Tag(words[headIndex])
		if strings.Contains(headTag, "nomn") && strings.Contains(headTag, number) {
			return form, formIndex, true
		}
	}

	// Some Russian forms are ambiguous in isolation (for example, «работы»
	// may be singular genitive or plural nominative). In a phrase, a preceding
	// adjective often has an unambiguous nominative tag and disambiguates it.
	for formIndex, form := range forms {
		words := strings.Fields(form)
		if headIndex >= len(words) {
			continue
		}
		for i := 0; i < headIndex; i++ {
			tag := analyzer.Tag(words[i])
			if strings.Contains(tag, "ADJF") && strings.Contains(tag, "nomn") && strings.Contains(tag, number) {
				return form, formIndex, true
			}
		}
	}
	return "", 0, false
}

func normalizeHyphenatedNoun(analyzer *morph.Analyzer, title, word, number string, debug bool) string {
	forms := analyzer.WordForms(word)
	inputTag := analyzer.Tag(word)
	formIndex := 0
	if number == "plur" {
		// In WordForms feminine plural nominative precedes the singular
		// oblique forms (index 1), while masculine plural nominative is
		// at index 5. The input tag disambiguates the gender.
		if strings.Contains(inputTag, "femn") {
			formIndex = 1
		} else {
			formIndex = 5
		}
	}
	if formIndex < len(forms) {
		form := forms[formIndex]
		categoryNormalizationLog(debug, "input=%q head=%q head_index=0 number=%s forms=%d selected_form=%d result=%q compound=true input_tag=%q", title, word, number, len(forms), formIndex, form, inputTag)
		return form
	}
	categoryNormalizationLog(debug, "input=%q head=%q head_index=0 number=%s forms=%d reason=form_not_found result=%q compound=true", title, word, number, len(forms), title)
	return title
}

func categoryNormalizationDebugEnabled() bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv("CATEGORY_NORMALIZATION_DEBUG"))) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

func categoryNormalizationLog(enabled bool, format string, args ...interface{}) {
	if enabled {
		log.Printf("[category-normalization] "+format, args...)
	}
}

func getCategoryAnalyzer() *morph.Analyzer {
	categoryAnalyzerOnce.Do(func() {
		categoryAnalyzer, _ = morph.Default()
	})
	return categoryAnalyzer
}

func findCategoryHead(analyzer *morph.Analyzer, words []string) (int, string, bool) {
	// Search from the end so an adjective with an ambiguous dictionary parse
	// (for example, «новых») does not become the grammatical head.
	for i := len(words) - 1; i >= 0; i-- {
		word := words[i]
		tag := analyzer.Tag(word)
		if !strings.Contains(tag, "NOUN") && !strings.Contains(tag, "NPRO") {
			continue
		}
		if strings.Contains(tag, " plur") {
			return i, "plur", true
		}
		if strings.Contains(tag, " sing") {
			return i, "sing", true
		}
	}
	return 0, "", false
}
