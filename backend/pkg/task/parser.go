package task

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

var (
	taskLineRe = regexp.MustCompile(`^[\s]*[-*]\s*\[([^\]]*)\]\s*(.*)$`)
	attrRe     = regexp.MustCompile(`\[(\w+):\s*((?:"[^"]*")|(?:[^]]+))\]`)
	hashtagRe  = regexp.MustCompile(`#([\w-]+(?:/[\w-]+)*)`)
)

type ParseError struct {
	Line    string
	Message string
}

func (e *ParseError) Error() string {
	return fmt.Sprintf("invalid task line: %s (line: %q)", e.Message, e.Line)
}

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("invalid %s: %s", e.Field, e.Message)
}

func ParseTaskLine(line string) (*Task, error) {
	matches := taskLineRe.FindStringSubmatch(line)
	if matches == nil {
		return nil, &ParseError{Line: line, Message: "not a valid task line (expected '- [status] text')"}
	}

	status := strings.TrimSpace(matches[1])
	remaining := strings.TrimSpace(matches[2])

	done := status == StatusDone

	attrs := parseAttributes(remaining)
	text := strings.TrimSpace(stripAttributes(remaining))

	if text == "" {
		return nil, &ParseError{Line: line, Message: "empty task — no text or attributes"}
	}

	t := &Task{
		Status:  status,
		Done:    done,
		Text:    text,
		Tags:    ExtractTags(text),
		RawLine: line,
	}

	known := map[string]bool{"due": true, "deferred": true, "name": true, "priority": true, "dependsOn": true, "recur": true}

	for k, v := range attrs {
		if known[k] {
			continue
		}
		if t.ExtraAttrs == nil {
			t.ExtraAttrs = make(map[string]string)
		}
		t.ExtraAttrs[k] = v
	}

	if v, ok := attrs["due"]; ok {
		t.Due = v
	}
	if v, ok := attrs["deferred"]; ok {
		t.Deferred = v
	}
	if v, ok := attrs["name"]; ok {
		t.Name = v
	}
	if v, ok := attrs["priority"]; ok {
		t.Priority = v
	}
	if v, ok := attrs["dependsOn"]; ok {
		t.DependsOn = strings.Fields(v)
	}
	if v, ok := attrs["recur"]; ok {
		if _, _, ok2 := ParseRecurrence(v); ok2 {
			t.Recur = v
		}
	}

	return t, nil
}

func ParseTasksFromPage(content string, pagePath string) ([]Task, error) {
	var tasks []Task
	lines := strings.Split(content, "\n")
	pos := 0

	for _, line := range lines {
		t, err := ParseTaskLine(line)
		if err != nil {
			continue
		}
		pos++
		t.Page = pagePath
		t.Position = pos
		tasks = append(tasks, *t)
	}

	return tasks, nil
}

func parseAttributes(text string) map[string]string {
	attrs := make(map[string]string)
	matches := attrRe.FindAllStringSubmatch(text, -1)
	for _, m := range matches {
		key := m[1]
		val := strings.Trim(m[2], "\"")
		attrs[key] = val
	}
	return attrs
}

func stripAttributes(text string) string {
	return strings.TrimSpace(attrRe.ReplaceAllString(text, ""))
}

func ExtractTags(text string) []string {
	matches := hashtagRe.FindAllStringSubmatch(text, -1)
	seen := make(map[string]bool)
	var tags []string
	for _, m := range matches {
		tag := m[1]
		if !seen[tag] {
			seen[tag] = true
			tags = append(tags, tag)
		}
	}
	return tags
}

var recurRe = regexp.MustCompile(`^(daily|weekly|monthly|yearly):(\d+)$`)

func ParseRecurrence(recur string) (interval string, n int, ok bool) {
	m := recurRe.FindStringSubmatch(recur)
	if m == nil {
		return "", 0, false
	}
	interval = m[1]
	n, err := strconv.Atoi(m[2])
	if err != nil || n <= 0 {
		return "", 0, false
	}
	return interval, n, true
}

func FindNthTask(lines []string, pos int) int {
	count := 0
	for i, line := range lines {
		_, err := ParseTaskLine(line)
		if err != nil {
			continue
		}
		count++
		if count == pos {
			return i
		}
	}
	return -1
}
