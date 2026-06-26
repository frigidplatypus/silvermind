package cmd

import (
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/query"
	"github.com/justin/sbtask/pkg/task"
)

var (
	listStatus      []string
	listPage        string
	listDueBefore   string
	listDueAfter    string
	listSchedBefore string
	listSchedAfter  string
	listName        string
	listPriority    string
	listTags        []string
	listOverdue     bool
	listSearch      string
	listSort        string
	listSortOrder   string
	listLimit       int
	listOffset      int
	listParent      string
	listOrphan      bool
	listRecur       bool
	listExcludeTags []string
)

var listCmd = &cobra.Command{
	Use:   "list",
	Short: "List available tasks across the SilverBullet space",
	Long: `List available tasks with optional filtering.

By default, only active tasks are shown (excludes done and waiting).
Use --status x to see completed tasks, --status waiting to see deferred tasks,
or --status all to see everything.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		c, _, sc, err := loadClient()
		if err != nil {
			return err
		}

		q := query.NewQuery(c)

		excludeTags := append(sc.ExcludeTags, listExcludeTags...)

		filter := task.TaskFilter{
			Status:          normaliseStatus(listStatus),
			Page:            listPage,
			DueBefore:       listDueBefore,
			DueAfter:        listDueAfter,
			DeferredBefore: listSchedBefore,
			DeferredAfter:  listSchedAfter,
			Name:            listName,
			Priority:        listPriority,
			Tags:            listTags,
			Parent:          listParent,
			Orphan:          listOrphan,
			Recur:           listRecur,
			ExcludeTags:     excludeTags,
			Overdue:         listOverdue,
			TextSearch:      listSearch,
			SortBy:          listSort,
			SortOrder:       listSortOrder,
			Limit:           listLimit,
			Offset:          listOffset,
		}

		tasks, err := q.Execute(filter)
		if err != nil {
			return err
		}

		saveListCache(tasks)

		if !cmd.Flags().Changed("status") && !listOverdue && !listRecur && !listOrphan && listParent == "" {
			tasks = excludeDoneAndWaiting(tasks)
		}

		hasStatus := cmd.Flags().Changed("status")
		if hasStatus {
			for _, s := range listStatus {
				if s == "blocked" {
					tasks = filterByBlockedFn(tasks)
				} else if s == "unblocked" {
					tasks = filterByUnblockedFn(tasks)
				}
			}
		}

		if jsonOutput {
			out, err := formatJSON(tasks)
			if err != nil {
				return err
			}
			fmt.Print(out)
			return nil
		}

		fmt.Print(formatTable(tasks, sc.Space))
		return nil
	},
}

func init() {
	rootCmd.AddCommand(listCmd)

	listCmd.Flags().StringSliceVar(&listStatus, "status", nil, "Filter by task status: waiting, maybe, x (done), blocked, unblocked, all. Repeat for multiple.")
	listCmd.Flags().StringVar(&listPriority, "priority", "", "Filter by priority: high, medium, low")
	listCmd.Flags().StringSliceVar(&listTags, "tag", nil, "Filter by hashtag (repeatable for AND: --tag western --tag urgent)")
	listCmd.Flags().StringVar(&listPage, "page", "", "Filter by page path")
	listCmd.Flags().StringVar(&listDueBefore, "due-before", "", "Tasks due before date (YYYY-MM-DD)")
	listCmd.Flags().StringVar(&listDueAfter, "due-after", "", "Tasks due after date (YYYY-MM-DD)")
	listCmd.Flags().StringVar(&listSchedBefore, "deferred-before", "", "Tasks deferred before date (YYYY-MM-DD)")
	listCmd.Flags().StringVar(&listSchedAfter, "deferred-after", "", "Tasks deferred after date (YYYY-MM-DD)")
	listCmd.Flags().StringVar(&listName, "name", "", "Filter by name attribute")
	listCmd.Flags().BoolVar(&listOverdue, "overdue", false, "Show only overdue tasks (due before today, not done)")
	listCmd.Flags().StringVar(&listSearch, "search", "", "Search task text")
	listCmd.Flags().StringVar(&listSort, "sort", "", "Sort by: due, deferred, page, pos")
	listCmd.Flags().StringVar(&listSortOrder, "sort-order", "asc", "Sort order: asc or desc")
	listCmd.Flags().IntVar(&listLimit, "limit", 0, "Maximum results (default 100)")
	listCmd.Flags().IntVar(&listOffset, "offset", 0, "Results offset for pagination")
	listCmd.Flags().StringVar(&listParent, "parent", "", "Show children of a parent task (by ref)")
	listCmd.Flags().BoolVar(&listOrphan, "orphan", false, "Show only top-level tasks (no parent)")
	listCmd.Flags().BoolVar(&listRecur, "recur", false, "Show only recurring tasks")
	listCmd.Flags().StringSliceVar(&listExcludeTags, "exclude-tag", nil, "Exclude tasks with this tag (repeatable)")
}

func normaliseStatus(s []string) []string {
	var out []string
	for _, v := range s {
		if strings.EqualFold(v, "all") {
			return nil
		}
		if strings.EqualFold(v, "blocked") || strings.EqualFold(v, "unblocked") {
			continue
		}
		if strings.EqualFold(v, "x") || strings.EqualFold(v, "done") {
			out = append(out, "x")
		} else {
			out = append(out, strings.ToLower(v))
		}
	}
	return out
}

func filterByBlockedFn(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if tk.Blocked {
			out = append(out, tk)
		}
	}
	return out
}

func filterByUnblockedFn(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if !tk.Blocked {
			out = append(out, tk)
		}
	}
	return out
}

func excludeDoneAndWaiting(tasks []task.Task) []task.Task {
	filtered := make([]task.Task, 0, len(tasks))
	for _, t := range tasks {
		if t.Status == task.StatusDone || t.Status == task.StatusWaiting {
			continue
		}
		filtered = append(filtered, t)
	}
	return filtered
}
