package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/task"
)

var (
	createPage      string
	createStatus    string
	createDue       string
	createScheduled string
	createName      string
	createPriority  string
	createTags      []string
	createRecur     string
)

var createCmd = &cobra.Command{
	Use:   "create <text>",
	Short: "Create a new task",
	Long: `Create a new task on a SilverBullet page with optional attributes.

The --due and --scheduled flags accept:
  - YYYY-MM-DD (e.g., 2026-06-19)
  - YYYY-MM-DD HH:mm (e.g., 2026-06-19 14:00)
  - Natural language (e.g., "tomorrow", "next Friday at 3pm", "in 2 days")`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, sc, err := loadClient()
		if err != nil {
			return err
		}

		page := createPage
		if page == "" {
			page = sc.DefaultPage
		}

		for _, tag := range createTags {
			if !task.ValidTag(tag) {
				return &task.ValidationError{
					Field:   "tag",
					Message: fmt.Sprintf("invalid tag %q: must contain only word chars, hyphens, or '/' for hierarchy", tag),
				}
			}
		}

		t := task.Task{
			Text:     task.AppendTags(args[0], createTags),
			Status:   createStatus,
			Name:     createName,
			Priority: createPriority,
		}

		if createRecur != "" {
			if _, _, ok := task.ParseRecurrence(createRecur); !ok {
				return &task.ValidationError{
					Field:   "recur",
					Message: fmt.Sprintf("invalid --recur %q: expected daily:N, weekly:N, monthly:N, or yearly:N", createRecur),
				}
			}
			t.Recur = createRecur
		}

		if err := task.ValidateTask(&t); err != nil {
			return err
		}

		if createDue != "" {
			dateStr, err := task.ParseDate(createDue)
			if err != nil {
				return fmt.Errorf("invalid --due date: %w", err)
			}
			datePart, timePart := task.SplitDateTime(dateStr)
			t.Due = task.FormatJournalLink(datePart, timePart)
		}

		if createScheduled != "" {
			dateStr, err := task.ParseDate(createScheduled)
			if err != nil {
				return fmt.Errorf("invalid --scheduled date: %w", err)
			}
			datePart, timePart := task.SplitDateTime(dateStr)
			t.Scheduled = task.FormatJournalLink(datePart, timePart)
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
			fmt.Fprintf(os.Stderr, "warning: page %q does not exist; creating it\n", page)
		}

		if err := c.AppendTask(page, line); err != nil {
			return fmt.Errorf("create task on %s: %w", page, err)
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

		fmt.Printf("Created task on %s: %s\n", page, t.Text)
		return nil
	},
}

func init() {
	createCmd.Flags().StringVar(&createPage, "page", "", "Target page path (uses default page if not specified)")
	createCmd.Flags().StringVar(&createStatus, "status", "", "Task status (waiting, maybe, or empty for active)")
	createCmd.Flags().StringVar(&createDue, "due", "", "Due date (YYYY-MM-DD, YYYY-MM-DD HH:mm, or natural language)")
	createCmd.Flags().StringVar(&createScheduled, "scheduled", "", "Scheduled date (same formats as --due)")
	createCmd.Flags().StringVar(&createName, "name", "", "Name attribute for the task")

	createCmd.Flags().StringVar(&createPriority, "priority", "", "Priority: high, medium, low")
	createCmd.Flags().StringSliceVar(&createTags, "tag", nil, "Add hashtag to task (repeatable: --tag western --tag urgent)")
	createCmd.Flags().StringVar(&createRecur, "recur", "", "Recurrence: daily:N, weekly:N, monthly:N, yearly:N")

	rootCmd.AddCommand(createCmd)
}
