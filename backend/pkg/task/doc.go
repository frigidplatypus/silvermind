// Package task provides the domain model and parsing for SilverBullet tasks.
//
// Tasks in SilverBullet are markdown list items with optional status markers
// and custom attributes. This package handles:
//   - Parsing task lines from markdown content
//   - Serializing Task structs back to valid SilverBullet markdown
//   - Natural language date parsing via the when library
//   - Journal link formatting for [due: ...] and [deferred: ...] attributes
//   - Recurrence parsing and date arithmetic (daily/weekly/monthly/yearly)
//
// Tasks are uniquely identified by (page, position) where position is the
// 1-based ordinal index of the task among all tasks on that page.
//
// Advanced attributes:
//   [dependsOn: <name>]    Task blocks until named task is done
//   [recur: daily:1]      Task auto-regenerates on completion
//   [recur: monthly:1]    Monthly recurrence with month-end clamping
//
// Usage:
//
//	t, err := task.ParseTaskLine("- [waiting] Review PR [due: \"[[Journal/2026-06-19]]\"]")
//	if err != nil {
//	    log.Fatal(err)
//	}
//	fmt.Println(task.ToMarkdown()) // round-trips to original markdown
//
//	dateStr, err := task.ParseDate("tomorrow at 3pm")
//	fmt.Println(task.FormatJournalLink(dateStr, "")) // "[[Journal/2026-06-19]]"
//
//	next, _ := task.AdvanceDue("monthly:1", "2026-01-31")
//	fmt.Println(next) // "2026-02-28"
package task
