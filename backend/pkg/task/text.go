package task

import (
	"fmt"
	"regexp"
	"strings"
)

var hashtagStripPattern = regexp.MustCompile(`\s*#[\w-]+(?:/[\w-]+)*`)

func AppendTags(text string, tags []string) string {
	if len(tags) == 0 {
		return text
	}
	seen := make(map[string]bool)
	var b strings.Builder
	b.WriteString(strings.TrimRight(text, " "))
	for _, t := range tags {
		if t == "" {
			continue
		}
		key := strings.ToLower(t)
		if seen[key] {
			continue
		}
		seen[key] = true
		b.WriteString(" #")
		b.WriteString(t)
	}
	return b.String()
}

func StripHashtags(text string) string {
	return strings.TrimSpace(hashtagStripPattern.ReplaceAllString(text, ""))
}

func SplitDateTime(dateStr string) (datePart, timePart string) {
	if idx := strings.Index(dateStr, " "); idx >= 0 {
		return dateStr[:idx], dateStr[idx+1:]
	}
	return dateStr, ""
}

func ValidPriority(p string) bool {
	switch strings.ToLower(p) {
	case "high", "medium", "low":
		return true
	}
	return false
}

func ValidTag(tag string) bool {
	if tag == "" {
		return false
	}
	for _, r := range tag {
		if r == '/' {
			continue
		}
		if !isWordChar(r) && r != '-' {
			return false
		}
	}
	return true
}

func isWordChar(r rune) bool {
	return (r >= 'a' && r <= 'z') ||
		(r >= 'A' && r <= 'Z') ||
		(r >= '0' && r <= '9') ||
		r == '_'
}

func ValidStatus(s string) bool {
	if s == "" {
		return true
	}
	if strings.Contains(s, ":") {
		return false
	}
	return true
}

func ValidateTask(t *Task) error {
	if t == nil {
		return fmt.Errorf("task is nil")
	}
	if !ValidStatus(t.Status) {
		return &ValidationError{Field: "status", Message: "status must not contain ':'"}
	}
	if t.Priority != "" && !ValidPriority(t.Priority) {
		return &ValidationError{Field: "priority", Message: "priority must be high, medium, or low"}
	}
	if t.Recur != "" {
		if _, _, ok := ParseRecurrence(t.Recur); !ok {
			return &ValidationError{Field: "recur", Message: "recur must be daily:N, weekly:N, monthly:N, or yearly:N"}
		}
	}
	return nil
}
