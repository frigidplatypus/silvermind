package task

import (
	"fmt"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

var journalDateRe = regexp.MustCompile(`^\[\[Journal/(\d{4}-\d{2}-\d{2})\]\](?:\s(\d{2}:\d{2}))?$`)
var wikiLinkRe = regexp.MustCompile(`\[\[([^\]]+)\]\]`)

func (t *Task) ToMarkdown() string {
	if t.Text == "" {
		return ""
	}

	status := t.Status
	if status == "" {
		status = " "
	}
	var parts []string
	parts = append(parts, fmt.Sprintf("- [%s] %s", status, t.Text))

	if t.Due != "" {
		parts = append(parts, fmt.Sprintf(`[due: "%s"]`, t.Due))
	}
	if t.Scheduled != "" {
		parts = append(parts, fmt.Sprintf(`[scheduled: "%s"]`, t.Scheduled))
	}
	if t.Name != "" {
		parts = append(parts, fmt.Sprintf("[name: %s]", t.Name))
	}
	if t.Priority != "" {
		parts = append(parts, fmt.Sprintf("[priority: %s]", t.Priority))
	}
	if len(t.DependsOn) > 0 {
		parts = append(parts, fmt.Sprintf("[dependsOn: %s]", strings.Join(t.DependsOn, " ")))
	}
	if t.Recur != "" {
		parts = append(parts, fmt.Sprintf("[recur: %s]", t.Recur))
	}

	if len(t.ExtraAttrs) > 0 {
		keys := make([]string, 0, len(t.ExtraAttrs))
		for k := range t.ExtraAttrs {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			parts = append(parts, fmt.Sprintf("[%s: %s]", k, t.ExtraAttrs[k]))
		}
	}

	return strings.Join(parts, " ")
}

func FormatJournalLink(date string, timeStr string) string {
	link := fmt.Sprintf("[[Journal/%s]]", date)
	if timeStr != "" {
		link += " " + timeStr
	}
	return link
}

func ParseJournalLink(value string) (date string, timeStr string, ok bool) {
	matches := journalDateRe.FindStringSubmatch(strings.TrimSpace(value))
	if matches == nil {
		return "", "", false
	}
	date = matches[1]
	timeStr = matches[2]
	return date, timeStr, true
}

func FormatWikiLinks(text, spaceURL string) string {
	if spaceURL == "" {
		return text
	}
	return wikiLinkRe.ReplaceAllStringFunc(text, func(match string) string {
		inner := wikiLinkRe.FindStringSubmatch(match)[1]
		name := filepath.Base(inner)
		u := fmt.Sprintf("%s/%s", strings.TrimRight(spaceURL, "/"), url.PathEscape(inner))
		return fmt.Sprintf("[%s](%s)", name, u)
	})
}

func FormatWikiLinksShort(text string) string {
	return wikiLinkRe.ReplaceAllStringFunc(text, func(match string) string {
		inner := wikiLinkRe.FindStringSubmatch(match)[1]
		return filepath.Base(inner)
	})
}
