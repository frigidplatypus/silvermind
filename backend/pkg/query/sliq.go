package query

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/justin/sbtask/pkg/task"
)

var (
	queryBlockRe   = regexp.MustCompile(`\$\{query\[\[([\s\S]*?)\]\]\}`)
	fencedSLIQRe   = regexp.MustCompile("```sliq\n?([\\s\\S]*?)\n?```")
)

// QueryBlock represents a single SLIQ query block extracted from a page.
type QueryBlock struct {
	Title  string `json:"title"`
	SLIQ   string `json:"sliq"`
	Number int    `json:"number"`
}

// ExtractQueryBlocks finds all SLIQ blocks in a page's content,
// supporting both ${query[[...]]} and ```sliq ... ``` formats,
// associating each with the nearest preceding Markdown heading.
func ExtractQueryBlocks(content string) []QueryBlock {
	lines := strings.Split(content, "\n")

	type match struct {
		raw    string
		sliq   string
		offset int
	}

	var matches []match

	// Find ${query[[...]]} blocks
	for _, m := range queryBlockRe.FindAllStringSubmatch(content, -1) {
		matches = append(matches, match{
			raw:    m[0],
			sliq:   strings.TrimSpace(m[1]),
			offset: strings.Index(content, m[0]),
		})
	}

	// Find ```sliq ... ``` fenced blocks
	for _, m := range fencedSLIQRe.FindAllStringSubmatch(content, -1) {
		matches = append(matches, match{
			raw:    m[0],
			sliq:   strings.TrimSpace(m[1]),
			offset: strings.Index(content, m[0]),
		})
	}

	if len(matches) == 0 {
		return nil
	}

	// Sort by position in content
	for i := 0; i < len(matches); i++ {
		for j := i + 1; j < len(matches); j++ {
			if matches[j].offset < matches[i].offset {
				matches[i], matches[j] = matches[j], matches[i]
			}
		}
	}

	var blocks []QueryBlock
	for i, m := range matches {
		sliq := m.sliq
		if sliq == "" {
			continue
		}
		title := findNearestHeading(lines, findMatchLine(lines, content, m.raw, 0))
		if title == "" {
			title = fmt.Sprintf("Query %d", i+1)
		}
		blocks = append(blocks, QueryBlock{
			Title:  title,
			SLIQ:   sliq,
			Number: len(blocks) + 1,
		})
	}
	return blocks
}

// TranslateSLIQ parses a SLIQ query string into a TaskFilter and an optional
// post-filter function for filters that cannot be expressed server-side.
func resolveRelativeDates(sliq string) string {
	now := time.Now()
	today := now.Format("2006-01-02")
	tomorrow := now.AddDate(0, 0, 1).Format("2006-01-02")

	// weekday offsets for "this week" (Mon=0)
	wd := int(now.Weekday()) - 1
	if wd < 0 {
		wd = 6
	}
	weekStart := now.AddDate(0, 0, -wd).Format("2006-01-02")
	weekEnd := now.AddDate(0, 0, 6-wd).Format("2006-01-02")

	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location()).Format("2006-01-02")
	monthEnd := time.Date(now.Year(), now.Month()+1, 0, 0, 0, 0, 0, now.Location()).Format("2006-01-02")

	sliq = strings.ReplaceAll(sliq, "@today", today)
	sliq = strings.ReplaceAll(sliq, "@tomorrow", tomorrow)
	sliq = strings.ReplaceAll(sliq, "@week_start", weekStart)
	sliq = strings.ReplaceAll(sliq, "@week_end", weekEnd)
	sliq = strings.ReplaceAll(sliq, "@month_start", monthStart)
	sliq = strings.ReplaceAll(sliq, "@month_end", monthEnd)

	// Match @+N or @-N patterns (relative days)
	re := regexp.MustCompile(`@([+-]\d+)`)
	sliq = re.ReplaceAllStringFunc(sliq, func(m string) string {
		n, err := strconv.Atoi(m[1:])
		if err != nil {
			return m
		}
		return now.AddDate(0, 0, n).Format("2006-01-02")
	})

	return sliq
}

// normalizeSLIQ converts a real SilverBullet SLIQ query (with from clause,
// p. prefix, etc.) into the internal format that TranslateSLIQ expects.
// Lines starting with "from " or "select " are stripped; the variable prefix
// "p." is normalized to "t."; and "p.tags" is mapped to "t.itags" to match
// the RuntimeTask field used internally for tag lookups.
func normalizeSLIQ(sliq string) string {
	lines := strings.Split(sliq, "\n")
	var out []string
	for _, line := range lines {
		line := strings.TrimSpace(line)
		if line == "" {
			continue
		}
		// Strip from / select clauses entirely
		if strings.HasPrefix(line, "from ") || strings.HasPrefix(line, "select ") {
			continue
		}
		// Normalize p. prefix to t. — p. is the conventional SLIQ variable.
		// Must be careful not to match "table.", "index.", etc.
		// We replace "p." → "t." with word-boundary before p, non-word after.
		line = strings.ReplaceAll(line, "p.", "t.")
		// Special case: p.tags → t.itags (SilverBullet tags vs our itags field)
		line = strings.ReplaceAll(line, "t.tags", "t.itags")
		out = append(out, line)
	}
	return strings.Join(out, "\n")
}

func TranslateSLIQ(sliq string) (task.TaskFilter, func([]task.Task) []task.Task) {
	sliq = resolveRelativeDates(sliq)
	sliq = normalizeSLIQ(sliq)
	filter := task.TaskFilter{Limit: 100}
	var pageExcludes []string
	var pageIncludes []string
	var clientFilters []func([]task.Task) []task.Task

	lines := strings.Split(sliq, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		if strings.HasPrefix(line, "limit ") {
			n, err := strconv.Atoi(strings.TrimPrefix(line, "limit "))
			if err == nil && n > 0 {
				filter.Limit = n
			}
			continue
		}

		if strings.HasPrefix(line, "where ") || strings.HasPrefix(line, "and ") {
			line = strings.TrimPrefix(line, "where ")
			line = strings.TrimPrefix(line, "and ")
			line = strings.TrimSpace(line)

			for _, clause := range strings.Split(line, " or ") {
				clause = strings.TrimSpace(clause)
				switch {
				case clause == "not t.done":
					// Handled by default exclusion
				case clause == "t.done":
					filter.Status = []string{"x"}
				case strings.HasPrefix(clause, "t.state =="):
					st := strings.Trim(clause[11:], " \"")
					st = strings.ToLower(st)
					if st == "waiting" || st == "x" || st == "maybe" || strings.EqualFold(st, "someday") {
						filter.Status = append(filter.Status, st)
					}
				case strings.HasPrefix(clause, "t.state !="):
					st := strings.Trim(clause[12:], " \"")
					st = strings.ToLower(st)
					if st != "" {
						exclude := st
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								if !strings.EqualFold(t.Status, exclude) {
									out = append(out, t)
								}
							}
							return out
						})
					}
				case strings.Contains(clause, "not table.includes(t.itags,"):
					tag := extractSLIQString(clause, "not table.includes(t.itags,")
					if tag != "" {
						exclude := tag
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								has := false
								for _, tt := range t.Tags {
									if strings.EqualFold(tt, exclude) {
										has = true
										break
									}
								}
								if !has {
									out = append(out, t)
								}
							}
							return out
						})
					}
				case strings.Contains(clause, "table.includes(t.itags,"):
					tag := extractSLIQString(clause, "table.includes(t.itags,")
					if tag != "" {
						filter.Tags = append(filter.Tags, tag)
					}
				case strings.Contains(clause, "not t.page:startsWith("):
					prefix := extractSLIQString(clause, "not t.page:startsWith(")
					if prefix != "" {
						pageExcludes = append(pageExcludes, prefix)
					}
				case strings.Contains(clause, "t.page:startsWith("):
					prefix := extractSLIQString(clause, "t.page:startsWith(")
					if prefix != "" {
						pageIncludes = append(pageIncludes, prefix)
					}
				case strings.HasPrefix(clause, "t.page =="):
					page := strings.Trim(clause[10:], " \"")
					if page != "" {
						filter.Page = page
					}
				case strings.HasPrefix(clause, "t.priority =="):
					pri := strings.Trim(clause[14:], " \"")
					if pri != "" {
						filter.Priority = strings.ToLower(pri)
					}
				case strings.HasPrefix(clause, "t.name =="):
					name := strings.Trim(clause[10:], " \"")
					if name != "" {
						filter.Name = name
					}
				case strings.Contains(clause, "t.scheduled:find"):
					dateStr := extractSLIQString(clause, "t.scheduled:find")
					if dateStr != "" {
						today := "[[Journal/" + dateStr + "]]"
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								if strings.Contains(t.Scheduled, today) {
									out = append(out, t)
								}
							}
							return out
						})
					}
				case strings.Contains(clause, "t.scheduled") && strings.Contains(clause, "<"):
					dateVal := extractQuotedValue(clause)
					if dateVal != "" {
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								if t.Scheduled != "" && t.Scheduled < dateVal {
									out = append(out, t)
								}
							}
							return out
						})
					}
				case strings.Contains(clause, "t.due") && strings.Contains(clause, "<"):
					dueVal := extractQuotedValue(clause)
					if dueVal != "" {
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								if t.Due != "" && t.Due < dueVal {
									out = append(out, t)
								}
							}
							return out
						})
					}
				case strings.Contains(clause, "t.due") && strings.Contains(clause, ">"):
					dueVal := extractQuotedValue(clause)
					if dueVal != "" {
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								if t.Due != "" && t.Due > dueVal {
									out = append(out, t)
								}
							}
							return out
						})
					}
				case strings.HasPrefix(clause, "t.extra_attrs."):
					extraAttrFilter(clause, &clientFilters)
				case strings.Contains(clause, "!=") && strings.Contains(clause, "nil"):
					parts := strings.SplitN(clause, "!=", 2)
					if len(parts) == 2 {
						field := strings.TrimSpace(parts[0])
						field = strings.TrimPrefix(field, "t.")
						if field == "due" || field == "scheduled" {
							clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
								var out []task.Task
								for _, t := range tasks {
									if (field == "due" && t.Due != "") || (field == "scheduled" && t.Scheduled != "") {
										out = append(out, t)
									}
								}
								return out
							})
						}
					}
				case strings.Contains(clause, "==") && strings.Contains(clause, "nil"):
					parts := strings.SplitN(clause, "==", 2)
					if len(parts) == 2 {
						field := strings.TrimSpace(parts[0])
						field = strings.TrimPrefix(field, "t.")
						if field == "due" || field == "scheduled" {
							clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
								var out []task.Task
								for _, t := range tasks {
									if (field == "due" && t.Due == "") || (field == "scheduled" && t.Scheduled == "") {
										out = append(out, t)
									}
								}
								return out
							})
						}
					}
				// Catch-all for t.<field> == "<value>" — custom attrs accessed directly
				// e.g. p.project == "alpha" (valid SilverBullet SLIQ doesn't nest
				// custom attrs under extra_attrs). Must be after all known-field cases.
				case strings.HasPrefix(clause, "t.") && strings.Contains(clause, "=="):
					field, val, ok := parseAttrEquality(clause)
					if ok && val != "" {
						clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
							var out []task.Task
							for _, t := range tasks {
								if t.ExtraAttrs != nil {
									if v, exists := t.ExtraAttrs[field]; exists && v == val {
										out = append(out, t)
									}
								}
							}
							return out
						})
					}
				}
			}
		}

		if strings.HasPrefix(line, "order by ") {
			line = strings.TrimPrefix(line, "order by ")
			line = strings.TrimSpace(line)
			parts := strings.Fields(line)
			if len(parts) >= 1 {
				field := strings.TrimPrefix(parts[0], "t.")
				validSorts := map[string]bool{"page": true, "pos": true, "due": true, "scheduled": true, "priority": true}
				if validSorts[field] {
					filter.SortBy = field
					if len(parts) >= 2 && parts[1] == "desc" {
						filter.SortOrder = "desc"
					} else {
						filter.SortOrder = "asc"
					}
				}
			}
		}
	}

	if len(pageExcludes) > 0 {
		clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
			var out []task.Task
			for _, t := range tasks {
				excluded := false
				for _, p := range pageExcludes {
					if strings.HasPrefix(t.Page, p) {
						excluded = true
						break
					}
				}
				if !excluded {
					out = append(out, t)
				}
			}
			return out
		})
	}

	if len(pageIncludes) > 0 {
		clientFilters = append(clientFilters, func(tasks []task.Task) []task.Task {
			var out []task.Task
			for _, t := range tasks {
				matched := false
				for _, p := range pageIncludes {
					if strings.HasPrefix(t.Page, p) {
						matched = true
						break
					}
				}
				if matched {
					out = append(out, t)
				}
			}
			return out
		})
	}

	hasStatusFilter := len(filter.Status) > 0

	postFilter := func(tasks []task.Task) []task.Task {
		for _, f := range clientFilters {
			tasks = f(tasks)
		}
		if !hasStatusFilter {
			tasks = excludeDone(tasks)
		}
		return tasks
	}

	return filter, postFilter
}

func excludeDoneAndWaiting(tasks []task.Task) []task.Task {
	out := make([]task.Task, 0, len(tasks))
	for _, tk := range tasks {
		if tk.Status == "x" || strings.EqualFold(tk.Status, "done") ||
			strings.EqualFold(tk.Status, "waiting") {
			continue
		}
		out = append(out, tk)
	}
	return out
}

func excludeDone(tasks []task.Task) []task.Task {
	out := make([]task.Task, 0, len(tasks))
	for _, tk := range tasks {
		if tk.Done || tk.Status == "x" || strings.EqualFold(tk.Status, "done") {
			continue
		}
		out = append(out, tk)
	}
	return out
}

func extractSLIQString(line string, after string) string {
	idx := strings.Index(line, after)
	if idx < 0 {
		return ""
	}
	rest := line[idx+len(after):]
	rest = strings.TrimLeft(rest, " ,")
	rest = strings.Trim(rest, "\" ")
	if idx2 := strings.Index(rest, "\""); idx2 > 0 {
		rest = rest[:idx2]
	}
	rest = strings.TrimRight(rest, " )\t")
	rest = strings.Trim(rest, "\"")
	return rest
}

// parseAttrEquality extracts field name and value from a clause like
// t.project == "alpha" → field="project", val="alpha", ok=true.
// Only returns ok for clauses of the form t.<field> == "<value>".
func parseAttrEquality(clause string) (field, val string, ok bool) {
	field = strings.TrimPrefix(clause, "t.")
	if idx := strings.Index(field, "=="); idx > 0 {
		key := strings.TrimSpace(field[:idx])
		rest := strings.TrimSpace(field[idx+2:])
		val = strings.Trim(rest, "\"'")
		return key, val, true
	}
	return "", "", false
}

func extractQuotedValue(s string) string {
	idx := strings.Index(s, "\"")
	if idx < 0 {
		return ""
	}
	rest := s[idx+1:]
	idx2 := strings.Index(rest, "\"")
	if idx2 < 0 {
		return ""
	}
	return rest[:idx2]
}

func findMatchLine(lines []string, content string, match string, startFrom int) int {
	idx := strings.Index(content[startFrom:], match)
	if idx < 0 {
		return 0
	}
	charPos := startFrom + idx
	lineNum := 1
	count := 0
	for _, line := range lines {
		count += len(line) + 1
		if count > charPos {
			break
		}
		lineNum++
	}
	return lineNum - 1
}

func extraAttrFilter(clause string, clientFilters *[]func([]task.Task) []task.Task) {
	rest := strings.TrimPrefix(clause, "t.extra_attrs.")
	parts := strings.SplitN(rest, " ", 2)
	if len(parts) < 2 {
		return
	}
	key := strings.TrimSpace(parts[0])
	cond := strings.TrimSpace(parts[1])

	if strings.HasPrefix(cond, "==") {
		val := strings.Trim(cond[2:], " \"")
		if val != "" {
			*clientFilters = append(*clientFilters, func(tasks []task.Task) []task.Task {
				var out []task.Task
				for _, t := range tasks {
					if t.ExtraAttrs != nil {
						if v, ok := t.ExtraAttrs[key]; ok && v == val {
							out = append(out, t)
						}
					}
				}
				return out
			})
		}
	} else if strings.HasPrefix(cond, "!=") {
		val := strings.Trim(cond[2:], " \"")
		if val != "" {
			*clientFilters = append(*clientFilters, func(tasks []task.Task) []task.Task {
				var out []task.Task
				for _, t := range tasks {
					if t.ExtraAttrs == nil {
						out = append(out, t)
					} else if v, ok := t.ExtraAttrs[key]; !ok || v != val {
						out = append(out, t)
					}
				}
				return out
			})
		}
	} else if cond == "!= nil" {
		*clientFilters = append(*clientFilters, func(tasks []task.Task) []task.Task {
			var out []task.Task
			for _, t := range tasks {
				if t.ExtraAttrs != nil {
					if _, ok := t.ExtraAttrs[key]; ok {
						out = append(out, t)
					}
				}
			}
			return out
		})
	} else if cond == "== nil" {
		*clientFilters = append(*clientFilters, func(tasks []task.Task) []task.Task {
			var out []task.Task
			for _, t := range tasks {
				if t.ExtraAttrs == nil {
					out = append(out, t)
				} else if _, ok := t.ExtraAttrs[key]; !ok {
					out = append(out, t)
				}
			}
			return out
		})
	}
}

func findNearestHeading(lines []string, matchLine int) string {
	for i := matchLine - 1; i >= 0; i-- {
		l := strings.TrimSpace(lines[i])
		if strings.HasPrefix(l, "#") {
			return strings.TrimLeft(l, "# \t")
		}
	}
	return ""
}

var fullBlockRe = regexp.MustCompile(`\n?## [^\n]+\n\$\{query\[\[[\s\S]*?\]\]\}\n?`)

func ReplaceQueryBlock(content string, blockNumber int, newTitle, newSLIQ string) (string, error) {
	matches := fullBlockRe.FindAllStringIndex(content, -1)
	if blockNumber < 1 || blockNumber > len(matches) {
		return "", fmt.Errorf("block %d not found (page has %d blocks)", blockNumber, len(matches))
	}

	matchIdx := matches[blockNumber-1]
	newBlock := fmt.Sprintf("\n## %s\n${query[[\n%s\n]]}\n", newTitle, newSLIQ)

	return content[:matchIdx[0]] + newBlock + content[matchIdx[1]:], nil
}
