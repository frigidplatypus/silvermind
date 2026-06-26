package cmd

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/query"
	"github.com/justin/sbtask/pkg/task"
)

var todayCmd = &cobra.Command{
	Use:   "today",
	Short: "Show today's task landscape",
	Long: `Show tasks due today, deferred today, and overdue tasks.

This gives you a quick view of what's on your plate right now.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, sc, err := loadClient()
		if err != nil {
			return err
		}

		today := time.Now().Format("2006-01-02")
		q := query.NewQuery(c)

		overdue, err1 := q.Execute(task.TaskFilter{
			Overdue: true,
		})

		dueToday, err2 := q.Execute(task.TaskFilter{
			DueAfter:  today,
			DueBefore: today,
		})

		defToday, err3 := q.Execute(task.TaskFilter{
			DeferredAfter:  today,
			DeferredBefore: today,
		})

		if err1 != nil && err2 != nil && err3 != nil {
			return fmt.Errorf("all today queries failed: %w", err1)
		}

		// Filter out done tasks from due/deferred
		dueToday = filterNotDone(dueToday)
		defToday = filterNotDone(defToday)

		total := len(overdue) + len(dueToday) + len(defToday)

		if jsonOutput {
			type todayResult struct {
				Overdue    []task.Task `json:"overdue"`
				DueToday   []task.Task `json:"due_today"`
				SchedToday []task.Task `json:"deferred_today"`
			}
			data, err := json.MarshalIndent(todayResult{
				Overdue:    overdue,
				DueToday:   dueToday,
				SchedToday: defToday,
			}, "", "  ")
			if err != nil {
				return fmt.Errorf("encode result: %w", err)
			}
			fmt.Println(string(data))
			return nil
		}

		if len(overdue) > 0 {
			fmt.Println("── OVERDUE ───────────────────────────────────────────────────────────────────")
			fmt.Println()
			for i, t := range overdue {
				fmt.Print(formatRow(t, i+1, sc.Space))
				fmt.Println()
			}
			fmt.Println()
		}

		if len(dueToday) > 0 {
			fmt.Println("── DUE TODAY ──────────────────────────────────────────────────────────────────")
			fmt.Println()
			for i, t := range dueToday {
				fmt.Print(formatRow(t, i+1, sc.Space))
				fmt.Println()
			}
			fmt.Println()
		}

		if len(defToday) > 0 {
			fmt.Println("── DEFERRED TODAY ───────────────────────────────────────────────────────────")
			fmt.Println()
			for i, t := range defToday {
				fmt.Print(formatRow(t, i+1, sc.Space))
				fmt.Println()
			}
			fmt.Println()
		}

		fmt.Printf("%d task(s) on today's landscape\n", total)
		return nil
	},
}

func formatRow(t task.Task, ref int, spaceURL string) string {
	return renderRow(t, ref, spaceURL)
}

func filterNotDone(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, t := range tasks {
		if !t.Done {
			out = append(out, t)
		}
	}
	return out
}

func init() {
	rootCmd.AddCommand(todayCmd)
}
