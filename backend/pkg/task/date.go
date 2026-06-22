package task

import (
	"fmt"
	"regexp"
	"time"

	"github.com/olebedev/when"
	"github.com/olebedev/when/rules/common"
	"github.com/olebedev/when/rules/en"
)

var (
	exactDateRe = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})$`)
	exactTimeRe = regexp.MustCompile(`^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$`)
	whenParser  *when.Parser
)

func init() {
	whenParser = when.New(nil)
	whenParser.Add(en.All...)
	whenParser.Add(common.All...)
}

func ParseDate(input string) (string, error) {
	input = trimQuotes(input)
	if input == "" {
		return "", &ValidationError{Field: "date", Message: "date is required"}
	}

	if m := exactTimeRe.FindStringSubmatch(input); m != nil {
		return fmt.Sprintf("%s %s", m[1], m[2]), nil
	}

	if m := exactDateRe.FindStringSubmatch(input); m != nil {
		return m[1], nil
	}

	w := whenParser

	r, err := w.Parse(input, time.Now())
	if err != nil {
		return "", &ValidationError{Field: "date", Message: fmt.Sprintf("cannot parse '%s': %v", input, err)}
	}
	if r == nil {
		return "", &ValidationError{Field: "date", Message: fmt.Sprintf("cannot parse date expression '%s'", input)}
	}

	t := r.Time
	dateStr := t.Format("2006-01-02")

	if t.Hour() != 0 || t.Minute() != 0 || t.Second() != 0 {
		dateStr += " " + t.Format("15:04")
	}

	return dateStr, nil
}

func trimQuotes(s string) string {
	if len(s) >= 2 && s[0] == '"' && s[len(s)-1] == '"' {
		return s[1 : len(s)-1]
	}
	return s
}

func AdvanceDue(recur string, date string) (string, error) {
	if date == "" {
		return "", fmt.Errorf("no due date")
	}

	interval, n, ok := ParseRecurrence(recur)
	if !ok {
		return "", fmt.Errorf("invalid recur expression: %s", recur)
	}

	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return "", fmt.Errorf("invalid date: %s", date)
	}

	isLastDay := isLastDayOfMonth(t)

	switch interval {
	case "daily":
		t = t.AddDate(0, 0, n)
	case "weekly":
		t = t.AddDate(0, 0, 7*n)
	case "monthly":
		t = advanceMonthly(t, n, isLastDay)
	case "yearly":
		t = advanceYearly(t, n, isLastDay)
	}

	return t.Format("2006-01-02"), nil
}

func isLastDayOfMonth(t time.Time) bool {
	nextDay := t.AddDate(0, 0, 1)
	return nextDay.Month() != t.Month()
}

func advanceMonthly(t time.Time, n int, clampLastDay bool) time.Time {
	year, m, _ := t.Date()
	day := t.Day()

	newM := int(m) + n
	year += (newM - 1) / 12
	newM = ((newM - 1) % 12) + 1
	if newM < 1 {
		newM = 12
	}

	month := time.Month(newM)
	lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, t.Location()).Day()
	if clampLastDay || day > lastDay {
		day = lastDay
	}

	return time.Date(year, month, day, 0, 0, 0, 0, t.Location())
}

func advanceYearly(t time.Time, n int, clampLastDay bool) time.Time {
	year := t.Year() + n
	month := t.Month()
	day := t.Day()

	if month == time.February && day == 29 {
		if !isLeapYear(year) {
			day = 28
		}
	}

	lastDay := time.Date(year, month+1, 0, 0, 0, 0, 0, t.Location()).Day()
	if clampLastDay || day > lastDay {
		day = lastDay
	}

	return time.Date(year, month, day, 0, 0, 0, 0, t.Location())
}

func isLeapYear(y int) bool {
	return y%4 == 0 && (y%100 != 0 || y%400 == 0)
}
