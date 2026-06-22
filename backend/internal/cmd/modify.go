package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/task"
)

var (
	modifyText      string
	modifyStatus    string
	modifyDue       string
	modifyScheduled string
	modifyName      string
	modifyPriority  string
	modifyTags      []string
	clearStatus     bool
	clearDue        bool
	clearScheduled  bool
	clearName       bool
	clearPriority   bool
	clearTags       bool
)

var modifyCmd = &cobra.Command{
	Use:   "modify <page> <position>",
	Short: "Modify an existing task",
	Long: `Modify a task identified by page path and position (1-based index among tasks on that page).

Use --clear-* flags to remove a field. --status "" is an alias for --clear-status.`,
	Args: cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		page := args[0]
		pos, err := strconv.Atoi(args[1])
		if err != nil || pos < 1 {
			return &task.ValidationError{Field: "position", Message: "position must be a positive integer"}
		}

		c, _, _, err := loadClient()
		if err != nil {
			return err
		}

		var (
			modified bool
			t        task.Task
		)
		err = c.ReadModifyWrite(page, func(content string) (string, error) {
			if content == "" {
				return "", fmt.Errorf("page %s not found", page)
			}

			lines := strings.Split(content, "\n")
			taskIdx := task.FindNthTask(lines, pos)
			if taskIdx == -1 {
				return "", fmt.Errorf("task #%d not found on page %s", pos, page)
			}

			originalLine := lines[taskIdx]
			pt, err := task.ParseTaskLine(originalLine)
			if err != nil {
				return "", fmt.Errorf("parse task #%d on %s: %w", pos, page, err)
			}

			if cmd.Flags().Changed("text") {
				if modifyText == "" {
					return "", &task.ValidationError{Field: "text", Message: "text cannot be empty; use --clear-text is not supported, remove the line manually if needed"}
				}
				pt.Text = modifyText
				pt.Tags = task.ExtractTags(modifyText)
			}
			if cmd.Flags().Changed("status") {
				if !task.ValidStatus(modifyStatus) {
					return "", &task.ValidationError{Field: "status", Message: "status must not contain ':'"}
				}
				pt.Status = modifyStatus
			}
			if clearStatus {
				pt.Status = ""
			}
			if clearDue {
				pt.Due = ""
			}
			if clearScheduled {
				pt.Scheduled = ""
			}
			if clearName {
				pt.Name = ""
			}
			if cmd.Flags().Changed("due") {
				dateStr, err := task.ParseDate(modifyDue)
				if err != nil {
					return "", fmt.Errorf("invalid --due date: %w", err)
				}
				datePart, timePart := task.SplitDateTime(dateStr)
				pt.Due = task.FormatJournalLink(datePart, timePart)
			}
			if cmd.Flags().Changed("scheduled") {
				dateStr, err := task.ParseDate(modifyScheduled)
				if err != nil {
					return "", fmt.Errorf("invalid --scheduled date: %w", err)
				}
				datePart, timePart := task.SplitDateTime(dateStr)
				pt.Scheduled = task.FormatJournalLink(datePart, timePart)
			}
			if cmd.Flags().Changed("name") {
				pt.Name = modifyName
			}
			if clearPriority {
				pt.Priority = ""
			}
			if cmd.Flags().Changed("priority") {
				pt.Priority = modifyPriority
			}
			if clearTags {
				pt.Text = task.StripHashtags(pt.Text)
				pt.Tags = nil
			}
			if cmd.Flags().Changed("tag") {
				for _, tag := range modifyTags {
					if !task.ValidTag(tag) {
						return "", &task.ValidationError{
							Field:   "tag",
							Message: fmt.Sprintf("invalid tag %q: must contain only word chars, hyphens, or '/' for hierarchy", tag),
						}
					}
				}
				pt.Text = task.StripHashtags(pt.Text)
				pt.Text = task.AppendTags(pt.Text, modifyTags)
				pt.Tags = task.ExtractTags(pt.Text)
			}

			if err := task.ValidateTask(pt); err != nil {
				return "", err
			}

			pt.Done = pt.Status == task.StatusDone
			lines[taskIdx] = pt.ToMarkdown()
			newContent := strings.Join(lines, "\n")

			if newContent == content {
				return content, nil
			}

			modified = true
			pt.Page = page
			pt.Position = pos
			t = *pt
			return newContent, nil
		})
		if err != nil {
			return err
		}
		if !modified {
			fmt.Println("No changes made.")
			return nil
		}

		if jsonOutput {
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

		fmt.Printf("Modified task #%d on %s\n", pos, page)
		return nil
	},
}

func init() {
	modifyCmd.Flags().StringVar(&modifyText, "text", "", "New task text")
	modifyCmd.Flags().StringVar(&modifyStatus, "status", "", "New task status (waiting, maybe, or empty for active)")
	modifyCmd.Flags().BoolVar(&clearStatus, "clear-status", false, "Clear the task status (set to active)")
	modifyCmd.Flags().StringVar(&modifyDue, "due", "", "New due date")
	modifyCmd.Flags().BoolVar(&clearDue, "clear-due", false, "Remove the due date")
	modifyCmd.Flags().StringVar(&modifyScheduled, "scheduled", "", "New scheduled date")
	modifyCmd.Flags().BoolVar(&clearScheduled, "clear-scheduled", false, "Remove the scheduled date")
	modifyCmd.Flags().StringVar(&modifyName, "name", "", "New name attribute")
	modifyCmd.Flags().BoolVar(&clearName, "clear-name", false, "Remove the name attribute")

	modifyCmd.Flags().StringSliceVar(&modifyTags, "tag", nil, "Set hashtags (replaces existing, repeatable: --tag western --tag urgent)")
	modifyCmd.Flags().BoolVar(&clearTags, "clear-tags", false, "Remove all hashtags from the task")
	modifyCmd.Flags().StringVar(&modifyPriority, "priority", "", "Set priority: high, medium, low")
	modifyCmd.Flags().BoolVar(&clearPriority, "clear-priority", false, "Remove priority attribute")

	rootCmd.AddCommand(modifyCmd)
}
