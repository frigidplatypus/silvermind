package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/task"
)

var (
	inboxDue       string
	inboxDeferred string
	inboxName      string
	inboxPriority  string
	inboxTags      []string
)

var inboxCmd = &cobra.Command{
	Use:   "inbox <text>",
	Short: "Quick-capture a task to your inbox",
	Long: `Capture a task to your inbox page with minimal friction.

The task is created on your configured inbox page (default: Inbox).
All create flags are supported for adding context during capture.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, sc, err := loadClient()
		if err != nil {
			return err
		}

		page := sc.InboxPage
		if page == "" {
			page = "Inbox"
		}

		for _, tag := range inboxTags {
			if !task.ValidTag(tag) {
				return &task.ValidationError{
					Field:   "tag",
					Message: fmt.Sprintf("invalid tag %q: must contain only word chars, hyphens, or '/' for hierarchy", tag),
				}
			}
		}

		t := task.Task{
			Text:     task.AppendTags(args[0], inboxTags),
			Priority: inboxPriority,
			Name:     inboxName,
		}

		if err := task.ValidateTask(&t); err != nil {
			return err
		}

		if inboxDue != "" {
			dateStr, err := task.ParseDate(inboxDue)
			if err != nil {
				return fmt.Errorf("invalid --due date: %w", err)
			}
			datePart, timePart := task.SplitDateTime(dateStr)
			t.Due = task.FormatJournalLink(datePart, timePart)
		}

		if inboxDeferred != "" {
			dateStr, err := task.ParseDate(inboxDeferred)
			if err != nil {
				return fmt.Errorf("invalid --deferred date: %w", err)
			}
			datePart, timePart := task.SplitDateTime(dateStr)
			t.Deferred = task.FormatJournalLink(datePart, timePart)
		}

		line := t.ToMarkdown()
		if line == "" {
			return &task.ValidationError{Field: "text", Message: "task text is required"}
		}

		existing, _, err := c.ReadPage(page)
		if err != nil {
			return fmt.Errorf("check page %s: %w", page, err)
		}
		if existing == "" {
			fmt.Fprintf(os.Stderr, "warning: inbox page %q does not exist; creating it\n", page)
		}

		if err := c.AppendTask(page, line); err != nil {
			return fmt.Errorf("inbox capture to %s: %w", page, err)
		}

		if jsonOutput {
			t.Page = page
			data, err := json.MarshalIndent(t, "", "  ")
			if err != nil {
				return fmt.Errorf("encode task: %w", err)
			}
			if _, err := os.Stdout.Write(data); err != nil {
				return err
			}
			if len(data) > 0 && data[len(data)-1] != '\n' {
				fmt.Println()
			}
			return nil
		}

		fmt.Printf("Captured to %s: %s\n", page, t.Text)
		return nil
	},
}

func init() {
	inboxCmd.Flags().StringVar(&inboxDue, "due", "", "Due date")
	inboxCmd.Flags().StringVar(&inboxDeferred, "deferred", "", "Deferred date")
	inboxCmd.Flags().StringVar(&inboxName, "name", "", "Name attribute")
	inboxCmd.Flags().StringVar(&inboxPriority, "priority", "", "Priority: high, medium, low")
	inboxCmd.Flags().StringSliceVar(&inboxTags, "tag", nil, "Add hashtag (repeatable)")

	rootCmd.AddCommand(inboxCmd)
}
