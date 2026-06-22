package cmd

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/task"
)

var noRecur bool

var doneCmd = &cobra.Command{
	Use:   "done [ref]",
	Short: "Mark a task as done",
	Long:  `Mark a task as done by its list reference number. If no number is given, marks the last task. Uses the cached task list from the most recent 'sbtask list'.`,
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		return toggleDone(args, task.StatusDone)
	},
}

var undoCmd = &cobra.Command{
	Use:   "undo [ref]",
	Short: "Unmark a done task (set to active)",
	Long:  `Set a done task back to active by its list reference number. If no number is given, undoes the last task. Uses the cached task list from the most recent 'sbtask list'.`,
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		return toggleDone(args, task.StatusActive)
	},
}

func toggleDone(args []string, newStatus string) error {
	cache, err := loadListCache()
	if err != nil {
		return err
	}

	var ref int
	if len(args) > 0 {
		ref, err = strconv.Atoi(args[0])
		if err != nil || ref < 1 {
			return fmt.Errorf("invalid task reference: %q (use a number from 'sbtask list')", args[0])
		}
	} else {
		ref = len(cache)
	}

	page, pos, _, err := resolveTask(cache, ref)
	if err != nil {
		return err
	}

	c, _, _, err := loadClient()
	if err != nil {
		return err
	}

	isDone := newStatus == task.StatusDone

	var toggledTask *task.Task
	err = c.ReadModifyWrite(page, func(content string) (string, error) {
		if content == "" {
			return "", fmt.Errorf("page %s not found", page)
		}

		lines := strings.Split(content, "\n")
		taskIdx := task.FindNthTask(lines, pos)
		if taskIdx == -1 {
			return "", fmt.Errorf("task #%d not found on page %s (it may have been moved or deleted)", pos, page)
		}

		parsed, err := task.ParseTaskLine(lines[taskIdx])
		if err != nil {
			return "", fmt.Errorf("parse task: %w", err)
		}

		parsed.Status = newStatus
		parsed.Done = isDone
		lines[taskIdx] = parsed.ToMarkdown()
		newContent := strings.Join(lines, "\n")

		toggledTask = parsed
		return newContent, nil
	})
	if err != nil {
		return err
	}

	action := "marked done"
	if newStatus == task.StatusActive {
		action = "set to active"
	}
	fmt.Printf("%s task #%d: %s\n", action, ref, toggledTask.Text)

	if isDone && toggledTask.Name != "" {
		unblocked := findUnblocked(cache, toggledTask.Name)
		if len(unblocked) > 0 {
			var texts []string
			for _, ct := range unblocked {
				texts = append(texts, ct.Text)
			}
			fmt.Printf("Warning: completing this task unblocks %d other task(s): %s\n", len(unblocked), strings.Join(texts, ", "))
		}
	}

	if isDone && !noRecur && toggledTask.Recur != "" {
		if toggledTask.Due == "" {
			fmt.Println("Warning: cannot create next occurrence: no due date")
		} else {
			date, _, ok := task.ParseJournalLink(toggledTask.Due)
			if !ok {
				fmt.Println("Warning: cannot create next occurrence: invalid due date")
			} else {
				dueDate, err := task.AdvanceDue(toggledTask.Recur, date)
				if err != nil {
					fmt.Printf("Warning: cannot create next occurrence: %s\n", err)
				} else {
					newTask := task.Task{
						Text:      toggledTask.Text,
						Name:      toggledTask.Name,
						Priority:  toggledTask.Priority,
						Recur:     toggledTask.Recur,
						Due:       task.FormatJournalLink(dueDate, ""),
						Scheduled: toggledTask.Scheduled,
						DependsOn: toggledTask.DependsOn,
					}
					line := newTask.ToMarkdown()
					if err := c.AppendTask(page, line); err != nil {
						return fmt.Errorf("create next occurrence: %w", err)
					}
					fmt.Printf("Created next occurrence due %s\n", dueDate)
				}
			}
		}
	}

	return nil
}

func findUnblocked(cache []cachedTask, name string) []cachedTask {
	var out []cachedTask
	for _, ct := range cache {
		for _, dep := range ct.DependsOn {
			if dep == name {
				out = append(out, ct)
				break
			}
		}
	}
	return out
}

func init() {
	doneCmd.Flags().BoolVar(&noRecur, "no-recur", false, "Suppress recurrence generation")
	rootCmd.AddCommand(doneCmd)
	rootCmd.AddCommand(undoCmd)
}
