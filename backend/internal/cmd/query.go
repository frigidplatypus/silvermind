package cmd

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/query"
	"github.com/justin/sbtask/pkg/task"
)

var (
	queryNumber int
	queryName   string
	queryList   bool
)

var queryCmd = &cobra.Command{
	Use:   "query <page>",
	Short: "Run queries from a SilverBullet page",
	Long: `Extract and execute ${query[[ ... ]]} blocks from a SilverBullet page.

Reads a SilverBullet page, finds all SLIQ query blocks, translates them
to sbtask filter operations, and executes them via the Runtime API.
Results are displayed as task tables. Multi-query pages show sectioned
output with headings.

Supported SLIQ patterns:
  limit N                    Result limit
  not t.done                 Exclude completed (default)
  t.done                     Show only completed
  t.state == "WAITING"       Status filter (waiting, x, maybe, someday)
  t.state == "A" or ...      Multi-status OR filter
  table.includes(t.itags, X) Tag filter (includes inherited tags)
  not table.includes(itags)  Tag exclusion
  t.page == "Projects/infra" Single page filter
  t.page:startsWith("X")     Page prefix match
  not t.page:startsWith("X") Page prefix exclusion
  t.priority == "high"       Priority filter
  t.name == "my-task"        Name attribute filter
  t.due < "value"            Due before
  t.due > "value"            Due after
  t.scheduled:find(date)     Scheduled on specific date
  t.scheduled < value        Scheduled before
  t.due == nil               Tasks without due date
  t.due != nil               Tasks with due date
  order by t.field desc      Sort (page, pos, due, scheduled, priority)

The select clause (e.g. select templates.taskItem(t)) is ignored —
all queries return task data in the standard sbtask format.

Create dashboard pages in SilverBullet with sectioned queries, then
run them from the CLI or JSON output for scripting and automation.`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		page := args[0]

		c, _, _, err := loadClient()
		if err != nil {
			return err
		}

		content, _, err := c.ReadPage(page)
		if err != nil {
			return fmt.Errorf("read page %s: %w", page, err)
		}
		if content == "" {
			return fmt.Errorf("page %s not found", page)
		}

		blocks := query.ExtractQueryBlocks(content)
		if len(blocks) == 0 {
			return fmt.Errorf("no ${query[[...]]} blocks found on page %s", page)
		}

		if queryList {
			for _, b := range blocks {
				fmt.Printf("%d. %s\n", b.Number, b.Title)
			}
			return nil
		}

		var selected []query.QueryBlock
		if queryNumber > 0 {
			for _, b := range blocks {
				if b.Number == queryNumber {
					selected = append(selected, b)
					break
				}
			}
			if len(selected) == 0 {
				return fmt.Errorf("query #%d not found on page %s (1-%d available)", queryNumber, page, len(blocks))
			}
		} else if queryName != "" {
			for _, b := range blocks {
				if strings.Contains(strings.ToLower(b.Title), strings.ToLower(queryName)) {
					selected = append(selected, b)
				}
			}
			if len(selected) == 0 {
				return fmt.Errorf("no heading matching %q found on page %s", queryName, page)
			}
		} else {
			selected = blocks
		}

		q := query.NewQuery(c)

		for _, b := range selected {
			filter, postFilter := query.TranslateSLIQ(b.SLIQ)
			tasks, err := q.Execute(filter)
			if err != nil {
				return fmt.Errorf("query %q: %w", b.Title, err)
			}
			if postFilter != nil {
				tasks = postFilter(tasks)
			}

			if jsonOutput {
				type output struct {
					Title string      `json:"title,omitempty"`
					SLIQ  string      `json:"sliq,omitempty"`
					Tasks []task.Task `json:"tasks"`
				}
				out := output{Title: b.Title, Tasks: tasks}
				if len(selected) == 1 {
					out.SLIQ = b.SLIQ
				}
				data, _ := json.MarshalIndent(out, "", "  ")
				fmt.Println(string(data))
				continue
			}

			if len(selected) > 1 {
				fmt.Printf("\n── %s\n\n", b.Title)
			}
			if len(tasks) == 0 {
				fmt.Println("(no tasks)")
			} else {
				fmt.Print(formatTable(tasks, c.BaseURL()))
			}
		}

		return nil
	},
}

func init() {
	queryCmd.Flags().IntVar(&queryNumber, "number", 0, "Run a specific query by position (1-based)")
	queryCmd.Flags().StringVar(&queryName, "name", "", "Run queries under a heading containing this text")
	queryCmd.Flags().BoolVar(&queryList, "list", false, "List available queries without executing")
	rootCmd.AddCommand(queryCmd)
}
