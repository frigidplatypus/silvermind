package cmd

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"

	"github.com/charmbracelet/lipgloss"

	"github.com/justin/sbtask/pkg/task"
)

var (
	headerStyle = lipgloss.NewStyle().Bold(true).Underline(true)

	posCol      = lipgloss.NewStyle().Width(4).Align(lipgloss.Right)
	priorityCol = lipgloss.NewStyle().Width(3)
	statusCol = lipgloss.NewStyle().Width(8)
	textCol   = lipgloss.NewStyle().Width(40)
	dateCol   = lipgloss.NewStyle().Width(25)
	pageCol   = lipgloss.NewStyle().Width(32)
	dimStyle  = lipgloss.NewStyle().Foreground(lipgloss.Color("8"))
	gap       = "  "

	boldStyle   = lipgloss.NewStyle().Bold(true)
	italicStyle = lipgloss.NewStyle().Italic(true)
	tagStyle    = lipgloss.NewStyle().Foreground(lipgloss.Color("6")) // cyan

	doneFg    = lipgloss.Color("2")
	waitingFg = lipgloss.Color("3")
	maybeFg   = lipgloss.Color("4")
	overdueFg = lipgloss.Color("1")

	boldRe   = regexp.MustCompile(`\*\*(.+?)\*\*`)
	italicRe = regexp.MustCompile(`\*(.+?)\*`)
	underscoreRe = regexp.MustCompile(`_(.+?)_`)
	hashRe    = regexp.MustCompile(`#([\w-]+)`) // must be after bold/italic to avoid conflicts
)

func formatJSON(tasks []task.Task) (string, error) {
	data, err := json.MarshalIndent(tasks, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to format JSON: %w", err)
	}
	return string(data), nil
}

func formatTable(tasks []task.Task, spaceURL string) string {
	if len(tasks) == 0 {
		return "No tasks found."
	}

	var b strings.Builder

	hdrPos := headerStyle.Render(posCol.Render("#"))
	hdrPri := headerStyle.Render(priorityCol.Render("P"))
	hdrStatus := headerStyle.Render(statusCol.Render("STATUS"))
	hdrText := headerStyle.Render(textCol.Render("TEXT"))
	hdrDue := headerStyle.Render(dateCol.Render("DUE"))
	hdrSched := headerStyle.Render(dateCol.Render("SCHEDULED"))
	hdrPage := headerStyle.Render(pageCol.Render("PAGE"))

	b.WriteString(strings.Join([]string{hdrPos, hdrPri, hdrStatus, hdrText, hdrDue, hdrSched, hdrPage}, gap))
	b.WriteByte('\n')

	for i, t := range tasks {
		b.WriteString(renderRow(t, i+1, spaceURL))
		b.WriteByte('\n')
	}

	b.WriteString(fmt.Sprintf("\n%d task(s)\n", len(tasks)))
	return b.String()
}

func renderRow(t task.Task, ref int, spaceURL string) string {
	pos := posCol.Render(fmt.Sprintf("%d", ref))
	pri := renderPriority(t.Priority)
	status := renderStatus(t.Status)
	text := textCol.Render(renderText(t.Text, spaceURL))
	due := renderDate(t.Due)
	scheduled := renderDate(t.Scheduled)
	page := pageCol.Render(truncatePath(t.Page, 32))

	return strings.Join([]string{pos, pri, status, text, due, scheduled, page}, gap)
}

func renderText(s string, spaceURL string) string {
	clean := truncate(s, 40)
	clean = task.FormatWikiLinksShort(clean)
	clean = applyBold(clean)
	clean = applyItalic(clean)
	clean = applyHashtags(clean)
	return clean
}

func applyBold(s string) string {
	return boldRe.ReplaceAllStringFunc(s, func(match string) string {
		inner := boldRe.FindStringSubmatch(match)[1]
		return boldStyle.Render(inner)
	})
}

func applyItalic(s string) string {
	s = italicRe.ReplaceAllStringFunc(s, func(match string) string {
		inner := italicRe.FindStringSubmatch(match)[1]
		return italicStyle.Render(inner)
	})
	s = underscoreRe.ReplaceAllStringFunc(s, func(match string) string {
		inner := underscoreRe.FindStringSubmatch(match)[1]
		return italicStyle.Render(inner)
	})
	return s
}

func applyHashtags(s string) string {
	return hashRe.ReplaceAllStringFunc(s, func(match string) string {
		return tagStyle.Render(match)
	})
}

func renderPriority(p string) string {
	if p == "" {
		return priorityCol.Render(dimStyle.Render("-"))
	}
	switch strings.ToLower(p) {
	case "high":
		return priorityCol.Render(lipgloss.NewStyle().Foreground(lipgloss.Color("1")).Bold(true).Render("H"))
	case "medium":
		return priorityCol.Render(lipgloss.NewStyle().Foreground(lipgloss.Color("3")).Render("M"))
	case "low":
		return priorityCol.Render(lipgloss.NewStyle().Foreground(lipgloss.Color("2")).Render("L"))
	default:
		return priorityCol.Render(p)
	}
}

func renderStatus(s string) string {
	if s == "" {
		return statusCol.Render(dimStyle.Render("-"))
	}

	var fg lipgloss.TerminalColor
	var label string
	switch s {
	case task.StatusDone:
		fg = doneFg
		label = "done"
	case task.StatusWaiting:
		fg = waitingFg
		label = "waiting"
	case task.StatusMaybe:
		fg = maybeFg
		label = "maybe"
	default:
		fg = overdueFg
		label = s
	}

	return statusCol.Render(lipgloss.NewStyle().Foreground(fg).Render(label))
}

func renderDate(v string) string {
	if v == "" {
		return dateCol.Render(dimStyle.Render("-"))
	}
	return dateCol.Render(v)
}

func truncate(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	return string(runes[:max-1]) + "…"
}

func truncatePath(s string, max int) string {
	runes := []rune(s)
	if len(runes) <= max {
		return s
	}
	prefix := "…"
	for i := len(runes) - 1; i >= 0; i-- {
		if runes[i] == '/' {
			tail := string(runes[i+1:])
			avail := max - len([]rune(prefix)) - 1 // -1 for the /
			if avail <= 0 {
				return prefix
			}
			if len([]rune(tail)) > avail {
				tail = string([]rune(tail)[:avail-1]) + "…"
			}
			return prefix + "/" + tail
		}
	}
	return prefix + string(runes[len(runes)-(max-len([]rune(prefix))):])
}
