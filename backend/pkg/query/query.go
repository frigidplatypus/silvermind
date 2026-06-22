package query

import (
	"encoding/json"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/justin/sbtask/pkg/client"
	"github.com/justin/sbtask/pkg/task"
)

type Query struct {
	client *client.Client
}

func NewQuery(c *client.Client) *Query {
	return &Query{client: c}
}

func (q *Query) Execute(filter task.TaskFilter) ([]task.Task, error) {
	params := filterToQueryParams(filter)

	rtTasks, err := q.client.QueryTasks(params)
	if err != nil {
		return nil, fmt.Errorf("query failed: %w", err)
	}

	tasks := make([]task.Task, 0, len(rtTasks))
	for _, rt := range rtTasks {
		t := FromRuntime(rt)
		tasks = append(tasks, t)
	}

	normalizePositions(tasks)
	tasks = applyHardExclusions(tasks)

	if filter.Overdue {
		tasks = filterOverdue(tasks)
	}

	if len(filter.Tags) > 0 {
		tasks = filterByTags(tasks, filter.Tags)
	}

	if filter.SortBy != "" {
		sortTasks(tasks, filter.SortBy, filter.SortOrder)
	}

	computeBlocked(tasks)

	if filter.Parent != "" {
		tasks = filterByParent(tasks, filter.Parent)
	}
	if filter.Orphan {
		tasks = filterByOrphan(tasks)
	}
	if filter.Recur {
		tasks = filterByRecur(tasks)
	}
	if len(filter.ExcludeTags) > 0 {
		tasks = filterExcludeTags(tasks, filter.ExcludeTags)
	}

	return tasks, nil
}

func FromRuntime(rt client.RuntimeTask) task.Task {
	t := task.Task{
		Page:     rt.Page,
		Position: rt.Pos,
		Text:     rt.Name,
		Status:   strings.ToLower(strings.TrimSpace(rt.State)),
		Done:     rt.Done,
		Parent:   rt.Parent,
		Tags:     rt.ITags,
	}

	if len(t.Tags) == 0 {
		t.Tags = rt.Tags
	}

	extra := parseExtraAttrs(rt)
	if v, ok := extra["due"]; ok {
		t.Due = v
		delete(extra, "due")
	}
	if v, ok := extra["scheduled"]; ok {
		t.Scheduled = v
		delete(extra, "scheduled")
	}
	if v, ok := extra["name"]; ok {
		t.Name = v
		delete(extra, "name")
	}
	if v, ok := extra["priority"]; ok {
		t.Priority = v
		delete(extra, "priority")
	}
	if v, ok := extra["dependsOn"]; ok {
		t.DependsOn = strings.Fields(v)
		delete(extra, "dependsOn")
	}
	if v, ok := extra["recur"]; ok {
		if _, _, ok2 := task.ParseRecurrence(v); ok2 {
			t.Recur = v
		}
		delete(extra, "recur")
	}
	if len(extra) > 0 {
		t.ExtraAttrs = extra
	}

	return t
}

func parseExtraAttrs(rt client.RuntimeTask) map[string]string {
	data, err := json.Marshal(rt)
	if err != nil {
		return nil
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil
	}

	attrs := make(map[string]string)
	known := map[string]bool{
		"ref": true, "tag": true, "name": true,
		"done": true, "state": true, "page": true, "pos": true,
		"tags": true, "itags": true, "parent": true,
		"dependsOn": true, "recur": true,
	}

	for k, v := range raw {
		if known[k] {
			continue
		}
		if s, ok := v.(string); ok {
			attrs[k] = s
		}
	}

	return attrs
}

func filterToQueryParams(f task.TaskFilter) map[string]string {
	params := make(map[string]string)

	for _, s := range f.Status {
		params["where[state]"] = s // last wins if multiple statuses are given
	}

	if f.Page != "" {
		params["where[page]"] = f.Page
	}

	if f.Name != "" {
		params["where[name]"] = f.Name
	}

	if f.Name != "" {
		params["where[name]"] = f.Name
	}

	if f.Priority != "" {
		params["where[priority]"] = f.Priority
	}

	if f.TextSearch != "" {
		params["where[name][contains]"] = f.TextSearch
	}

	if f.DueAfter != "" {
		params["where[due][gte]"] = f.DueAfter
	}
	if f.DueBefore != "" {
		params["where[due][lte]"] = f.DueBefore
	}
	if f.ScheduledAfter != "" {
		params["where[scheduled][gte]"] = f.ScheduledAfter
	}
	if f.ScheduledBefore != "" {
		params["where[scheduled][lte]"] = f.ScheduledBefore
	}

	if f.SortBy != "" {
		order := f.SortBy
		if f.SortOrder == "desc" {
			order += ":desc"
		}
		params["order"] = order
	}

	if f.Limit > 0 {
		params["limit"] = strconv.Itoa(f.Limit)
	} else {
		params["limit"] = "100"
	}

	if f.Offset > 0 {
		params["offset"] = strconv.Itoa(f.Offset)
	}

	return params
}

func filterOverdue(tasks []task.Task) []task.Task {
	today := time.Now().Truncate(24 * time.Hour)
	var result []task.Task
	for _, t := range tasks {
		if t.Done || t.Due == "" {
			continue
		}
		date, _, ok := task.ParseJournalLink(t.Due)
		if !ok {
			continue
		}
		dueDate, err := time.Parse("2006-01-02", date)
		if err != nil {
			continue
		}
		if dueDate.Before(today) {
			result = append(result, t)
		}
	}
	return result
}

func filterByTags(tasks []task.Task, requiredTags []string) []task.Task {
	var result []task.Task
	for _, t := range tasks {
		if hasAllTags(t.Tags, requiredTags) {
			result = append(result, t)
		}
	}
	return result
}

func hasAllTags(taskTags, required []string) bool {
	for _, req := range required {
		found := false
		for _, tt := range taskTags {
			if strings.EqualFold(tt, req) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func normalizePositions(tasks []task.Task) {
	pageCounts := make(map[string]int)
	for i := range tasks {
		pageCounts[tasks[i].Page]++
		tasks[i].Position = pageCounts[tasks[i].Page]
	}
}

func sortTasks(tasks []task.Task, sortBy, order string) {
	sort.Slice(tasks, func(i, j int) bool {
		var less bool
		switch sortBy {
		case "page":
			less = tasks[i].Page < tasks[j].Page
		case "pos":
			less = tasks[i].Position < tasks[j].Position
		case "due":
			di, _, oki := task.ParseJournalLink(tasks[i].Due)
			dj, _, okj := task.ParseJournalLink(tasks[j].Due)
			if !oki {
				return false
			}
			if !okj {
				return true
			}
			less = di < dj
		case "scheduled":
			si, _, oki := task.ParseJournalLink(tasks[i].Scheduled)
			sj, _, okj := task.ParseJournalLink(tasks[j].Scheduled)
			if !oki {
				return false
			}
			if !okj {
				return true
			}
			less = si < sj
		default:
			if tasks[i].Page != tasks[j].Page {
				less = tasks[i].Page < tasks[j].Page
			} else {
				less = tasks[i].Position < tasks[j].Position
			}
		}
		if order == "desc" {
			return !less
		}
		return less
	})
}

func computeBlocked(tasks []task.Task) {
	nameToDone := make(map[string]bool)
	for i := range tasks {
		if tasks[i].Name != "" {
			if prev, exists := nameToDone[tasks[i].Name]; exists {
				nameToDone[tasks[i].Name] = prev && tasks[i].Done
			} else {
				nameToDone[tasks[i].Name] = tasks[i].Done
			}
		}
	}
	for i := range tasks {
		if len(tasks[i].DependsOn) == 0 {
			continue
		}
		for _, dep := range tasks[i].DependsOn {
			if tasks[i].Name == dep {
				tasks[i].Blocked = true
				break
			}
			done, exists := nameToDone[dep]
			if !exists || !done {
				tasks[i].Blocked = true
				break
			}
		}
	}
}

func filterByParent(tasks []task.Task, parent string) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if tk.Parent == parent {
			out = append(out, tk)
		}
	}
	return out
}

func filterByOrphan(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if tk.Parent == "" {
			out = append(out, tk)
		}
	}
	return out
}

func filterByRecur(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if tk.Recur != "" {
			out = append(out, tk)
		}
	}
	return out
}

func filterExcludeTags(tasks []task.Task, exclude []string) []task.Task {
	excludeSet := make(map[string]bool)
	for _, t := range exclude {
		excludeSet[strings.ToLower(t)] = true
	}
	var out []task.Task
	for _, tk := range tasks {
		excluded := false
		for _, tag := range tk.Tags {
			if excludeSet[strings.ToLower(tag)] {
				excluded = true
				break
			}
		}
		if !excluded {
			out = append(out, tk)
		}
	}
	return out
}

func applyHardExclusions(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if strings.HasPrefix(tk.Page, "Library/") {
			continue
		}
		hasMeta := false
		for _, tag := range tk.Tags {
			lower := strings.ToLower(tag)
			if lower == "meta" || strings.HasPrefix(lower, "meta/") {
				hasMeta = true
				break
			}
		}
		if hasMeta {
			continue
		}
		out = append(out, tk)
	}
	return out
}
