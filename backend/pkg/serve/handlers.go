package serve

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/justin/sbtask/pkg/client"
	"github.com/justin/sbtask/pkg/config"
	"github.com/justin/sbtask/pkg/query"
	"github.com/justin/sbtask/pkg/task"
)

type notFoundError struct{ msg string }

func (e *notFoundError) Error() string { return e.msg }

type TaskResponse struct {
	Page            string         `json:"page"`
	Position        int            `json:"position"`
	Text            string         `json:"text"`
	Status          string         `json:"status"`
	Done            bool           `json:"done"`
	Due             string         `json:"due"`
	DueParsed       *DateParsed    `json:"due_parsed,omitempty"`
	Deferred       string         `json:"deferred"`
	DeferredParsed *DateParsed    `json:"deferred_parsed,omitempty"`
	Name            string         `json:"name,omitempty"`
	Priority        string         `json:"priority,omitempty"`
	Tags            []string       `json:"tags,omitempty"`
	Parent          string         `json:"parent,omitempty"`
	DependsOn       []string       `json:"depends_on,omitempty"`
	Blocked         bool           `json:"blocked"`
	Recur           string            `json:"recur,omitempty"`
	ExtraAttrs      map[string]string `json:"extra_attrs,omitempty"`
	NextOccurrence  *TaskResponse     `json:"next_occurrence,omitempty"`
	RecurWarning    string            `json:"recur_warning,omitempty"`
}

type DateParsed struct {
	Date string `json:"date"`
	Time string `json:"time,omitempty"`
}

type CreateTaskRequest struct {
	Text      string   `json:"text"`
	Due       string   `json:"due,omitempty"`
	Deferred string   `json:"deferred,omitempty"`
	Status    string   `json:"status,omitempty"`
	Name      string   `json:"name,omitempty"`
	Priority  string   `json:"priority,omitempty"`
	Tags      []string          `json:"tags,omitempty"`
	Recur     string            `json:"recur,omitempty"`
	ExtraAttrs map[string]string `json:"extra_attrs,omitempty"`
}

type ModifyTaskRequest struct {
	Text      string    `json:"text,omitempty"`
	Status    string    `json:"status,omitempty"`
	Due       string    `json:"due,omitempty"`
	Deferred string    `json:"deferred,omitempty"`
	Name      string    `json:"name,omitempty"`
	Priority  string    `json:"priority,omitempty"`
	Tags      []string  `json:"tags,omitempty"`
	DependsOn *[]string           `json:"depends_on,omitempty"`
	Recur     string              `json:"recur,omitempty"`
	ExtraAttrs map[string]string  `json:"extra_attrs,omitempty"`
}

type HealthResponse struct {
	OK    bool   `json:"ok"`
	Space string `json:"space,omitempty"`
	Error string `json:"error,omitempty"`
}

type TodayResponse struct {
	Overdue        []TaskResponse `json:"overdue"`
	DueToday       []TaskResponse `json:"due_today"`
	DeferredToday []TaskResponse `json:"deferred_today"`
}

type SpaceInfo struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	Active bool   `json:"active"`
}

func (s *Server) resolveSpace(r *http.Request) (*client.Client, config.SpaceConfig, error) {
	name := r.URL.Query().Get("space")
	if name == "" {
		name = s.spaceName
	}
	url := r.URL.Query().Get("space_url")
	if url == "" {
		url = s.spaceURL
	}

	sc, err := config.ResolveSpace(s.cfg, name, url)
	if err != nil {
		return nil, config.SpaceConfig{}, err
	}

	if s.defaultPage != "" {
		sc.DefaultPage = s.defaultPage
	}

	c, err := client.NewClient(client.Config{SpaceURL: sc.Space, AuthToken: sc.AuthToken})
	if err != nil {
		return nil, config.SpaceConfig{}, err
	}

	return c, sc, nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "no_spaces_configured", err.Error())
		return
	}

	_, err = c.QueryTasks(map[string]string{"limit": "1"})
	if err != nil {
		writeError(w, http.StatusServiceUnavailable, "upstream_unavailable", err.Error())
		return
	}

	writeOK(w, HealthResponse{OK: true, Space: sc.Space})
}

func (s *Server) handleSpaces(w http.ResponseWriter, r *http.Request) {
	var spaces []SpaceInfo
	activeName := s.cfg.ActiveSpace
	if activeName == "" {
		for name := range s.cfg.Spaces {
			activeName = name
			break
		}
	}
	for name, sc := range s.cfg.Spaces {
		spaces = append(spaces, SpaceInfo{
			Name:   name,
			URL:    sc.Space,
			Active: name == activeName,
		})
	}
	writeOK(w, spaces)
}

func (s *Server) handleToday(w http.ResponseWriter, r *http.Request) {
	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	q := query.NewQuery(c)
	todayStr := time.Now().Format("2006-01-02")

	overdue, err := q.Execute(task.TaskFilter{Overdue: true})
	if err != nil {
		slog.Error("today overdue query failed", "error", err)
	}
	dueToday, err := q.Execute(task.TaskFilter{DueAfter: todayStr, DueBefore: todayStr})
	if err != nil {
		slog.Error("today due_today query failed", "error", err)
	}
	defToday, err := q.Execute(task.TaskFilter{DeferredAfter: todayStr, DeferredBefore: todayStr})
	if err != nil {
		slog.Error("today deferred_today query failed", "error", err)
	}

	dueToday = filterNotDone(dueToday)
	defToday = filterNotDone(defToday)

	writeOK(w, TodayResponse{
		Overdue:        tasksToResponse(overdue, sc.Space),
		DueToday:       tasksToResponse(dueToday, sc.Space),
		DeferredToday: tasksToResponse(defToday, sc.Space),
	})
}

func (s *Server) handleListTasks(w http.ResponseWriter, r *http.Request) {
	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	q := query.NewQuery(c)
	filter := task.TaskFilter{
		Status:          parseStatusParam(r.URL.Query()["status"]),
		Page:            r.URL.Query().Get("page"),
		DueBefore:       r.URL.Query().Get("due_before"),
		DueAfter:        r.URL.Query().Get("due_after"),
		DeferredBefore: r.URL.Query().Get("deferred_before"),
		DeferredAfter:  r.URL.Query().Get("deferred_after"),
		Name:            r.URL.Query().Get("name"),
		Priority:        r.URL.Query().Get("priority"),
		Tags:            r.URL.Query()["tag"],
		Parent:          r.URL.Query().Get("parent"),
		Orphan:          r.URL.Query().Get("orphan") == "true",
		Recur:           r.URL.Query().Get("recur") == "true",
		ExcludeTags:     append(sc.ExcludeTags, r.URL.Query()["exclude_tag"]...),
		Overdue:         r.URL.Query().Get("overdue") == "true",
		TextSearch:      r.URL.Query().Get("search"),
		SortBy:          r.URL.Query().Get("sort"),
		SortOrder:       r.URL.Query().Get("sort_order"),
		Limit:           intParam(r, "limit", 100),
		Offset:          intParam(r, "offset", 0),
	}

	tasks, err := q.Execute(filter)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	// Resolve true file-order positions so the position numbers
	// in the API response match what handleToggleDone/handleModifyTask
	// use for task lookup via ParseTasksFromPage.
	tasks = resolveFilePositions(tasks, c)

	if !hasStatusParam(r) && !filter.Overdue && !filter.Orphan && !filter.Recur && filter.Parent == "" {
		tasks = excludeDoneAndWaiting(tasks)
	}

	if hasBlockedStatus(r) {
		tasks = filterBlocked(tasks)
	} else if hasUnblockedStatus(r) {
		tasks = filterUnblocked(tasks)
	}

	writeOK(w, tasksToResponse(tasks, sc.Space))
}

func (s *Server) handleGetTask(w http.ResponseWriter, r *http.Request) {
	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	page := r.URL.Query().Get("page")
	if !checkPage(w, page) {
		return
	}
	pos, ok := parsePos(w, r)
	if !ok {
		return
	}

	content, _, err := c.ReadPage(page)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}
	if content == "" {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("task not found on page %s at position %d", page, pos))
		return
	}

	tasks, _ := task.ParseTasksFromPage(content, page)
	if pos > len(tasks) || pos < 1 {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("task not found on page %s at position %d", page, pos))
		return
	}

	tk := tasks[pos-1]
	writeOK(w, taskToResponse(tk, sc.Space))
}

func (s *Server) handleCreateInbox(w http.ResponseWriter, r *http.Request) {
	if err := requireJSON(r); err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "bad_request", err.Error())
		return
	}

	req, err := decodeJSON[CreateTaskRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid JSON: %s", err))
		return
	}

	if err := validateCreate(req); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	page := sc.InboxPage
	if page == "" {
		page = "Inbox"
	}

	tk := task.Task{
		Text:     task.AppendTags(req.Text, req.Tags),
		Status:   req.Status,
		Priority: req.Priority,
		Name:     req.Name,
	}

	if req.Recur != "" {
		if _, _, ok := task.ParseRecurrence(req.Recur); !ok {
			writeError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("invalid recur: %q", req.Recur))
			return
		}
		tk.Recur = req.Recur
	}

	if req.Due != "" {
		dateStr, err := task.ParseDate(req.Due)
		if err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("invalid due date: %s", err))
			return
		}
		dp, tp := task.SplitDateTime(dateStr)
		tk.Due = task.FormatJournalLink(dp, tp)
	}

	if req.Deferred != "" {
		dateStr, err := task.ParseDate(req.Deferred)
		if err != nil {
			writeError(w, http.StatusBadRequest, "validation_error", fmt.Sprintf("invalid deferred date: %s", err))
			return
		}
		dp, tp := task.SplitDateTime(dateStr)
		tk.Deferred = task.FormatJournalLink(dp, tp)
	}

	if len(req.ExtraAttrs) > 0 {
		tk.ExtraAttrs = req.ExtraAttrs
	}

	if err := task.ValidateTask(&tk); err != nil {
		writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		return
	}

	line := tk.ToMarkdown()
	if err := c.AppendTask(page, line); err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	tk.Page = page
	resp := taskToResponse(tk, sc.Space)
	writeJSON(w, http.StatusCreated, resp)
}

func (s *Server) handleModifyTask(w http.ResponseWriter, r *http.Request) {
	if err := requireJSON(r); err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "bad_request", err.Error())
		return
	}

	page := r.URL.Query().Get("page")
	if !checkPage(w, page) {
		return
	}
	pos, ok := parsePos(w, r)
	if !ok {
		return
	}

	req, err := decodeJSON[ModifyTaskRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid JSON: %s", err))
		return
	}

	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	var (
		modifiedTask task.Task
		notFound     bool
	)
	err = c.ReadModifyWrite(page, func(content string) (string, error) {
		if content == "" {
			notFound = true
			return "", &notFoundError{fmt.Sprintf("page %s not found", page)}
		}

		// Use ParseTasksFromPage for consistent position lookup (same as list endpoint)
		tasksOnPage, err := task.ParseTasksFromPage(content, page)
		if err != nil {
			return "", err
		}
		if pos > len(tasksOnPage) || pos < 1 {
			notFound = true
			return "", &notFoundError{fmt.Sprintf("task not found on page %s at position %d", page, pos)}
		}
		tk := &tasksOnPage[pos-1]

		// Also find the line index for in-place editing
		lines := strings.Split(content, "\n")
		idx := task.FindNthTask(lines, pos)
		if idx == -1 {
			return "", fmt.Errorf("task parse mismatch on page %s at position %d", page, pos)
		}

		if err := applyModify(tk, &req); err != nil {
			return "", err
		}
		if err := task.ValidateTask(tk); err != nil {
			return "", err
		}
		lines[idx] = tk.ToMarkdown()
		newContent := strings.Join(lines, "\n")

		modifiedTask = *tk
		modifiedTask.Page = page
		modifiedTask.Position = pos
		return newContent, nil
	})
	if err != nil {
		var vErr *task.ValidationError
		switch {
		case notFound:
			writeError(w, http.StatusNotFound, "not_found", err.Error())
		case errors.As(err, &vErr):
			writeError(w, http.StatusBadRequest, "validation_error", err.Error())
		default:
			writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		}
		return
	}

	writeOK(w, taskToResponse(modifiedTask, sc.Space))
}

func (s *Server) handleMarkDone(w http.ResponseWriter, r *http.Request) {
	s.handleToggleDone(w, r, task.StatusDone)
}

func (s *Server) handleMarkUndone(w http.ResponseWriter, r *http.Request) {
	s.handleToggleDone(w, r, task.StatusActive)
}

func (s *Server) handleDeleteTask(w http.ResponseWriter, r *http.Request) {
	page := r.URL.Query().Get("page")
	if !checkPage(w, page) {
		return
	}
	pos, ok := parsePos(w, r)
	if !ok {
		return
	}

	c, _, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	var notFound bool
	err = c.ReadModifyWrite(page, func(content string) (string, error) {
		if content == "" {
			notFound = true
			return "", &notFoundError{fmt.Sprintf("page %s not found", page)}
		}

		lines := strings.Split(content, "\n")
		idx := task.FindNthTask(lines, pos)
		if idx == -1 {
			notFound = true
			return "", &notFoundError{fmt.Sprintf("task not found on page %s at position %d", page, pos)}
		}

		newLines := append(lines[:idx], lines[idx+1:]...)
		return strings.Join(newLines, "\n"), nil
	})
	if err != nil {
		if notFound {
			writeError(w, http.StatusNotFound, "not_found", err.Error())
		} else {
			writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		}
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) handleToggleDone(w http.ResponseWriter, r *http.Request, newStatus string) {
	page := r.URL.Query().Get("page")
	if !checkPage(w, page) {
		return
	}
	pos, ok := parsePos(w, r)
	if !ok {
		return
	}

	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	var (
		toggledTask task.Task
		notFound    bool
	)
	err = c.ReadModifyWrite(page, func(content string) (string, error) {
		if content == "" {
			notFound = true
			return "", &notFoundError{fmt.Sprintf("page %s not found", page)}
		}

		// Use ParseTasksFromPage for consistent position lookup (same as list endpoint)
		tasksOnPage, err := task.ParseTasksFromPage(content, page)
		if err != nil {
			return "", err
		}
		if pos > len(tasksOnPage) || pos < 1 {
			notFound = true
			return "", &notFoundError{fmt.Sprintf("task not found on page %s at position %d", page, pos)}
		}
		tk := &tasksOnPage[pos-1]

		// Also find the line index for in-place editing
		lines := strings.Split(content, "\n")
		idx := task.FindNthTask(lines, pos)
		if idx == -1 {
			return "", fmt.Errorf("task parse mismatch on page %s at position %d", page, pos)
		}

		tk.Status = newStatus
		tk.Done = newStatus == task.StatusDone
		lines[idx] = tk.ToMarkdown()
		newContent := strings.Join(lines, "\n")

		toggledTask = *tk
		return newContent, nil
	})
	if err != nil {
		switch {
		case notFound:
			writeError(w, http.StatusNotFound, "not_found", err.Error())
		default:
			writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		}
		return
	}

	resp := taskToResponse(toggledTask, sc.Space)

	if newStatus == task.StatusDone && toggledTask.Recur != "" && toggledTask.Due != "" {
		date, _, ok := task.ParseJournalLink(toggledTask.Due)
		if ok {
			next, err := task.AdvanceDue(toggledTask.Recur, date)
			if err == nil {
				nextTask := task.Task{
					Text:       toggledTask.Text,
					Name:       toggledTask.Name,
					Priority:   toggledTask.Priority,
					Recur:      toggledTask.Recur,
					Due:        task.FormatJournalLink(next, ""),
					Deferred:  toggledTask.Deferred,
					DependsOn:  toggledTask.DependsOn,
					ExtraAttrs: toggledTask.ExtraAttrs,
				}
				if err := c.AppendTask(page, nextTask.ToMarkdown()); err != nil {
					writeError(w, http.StatusBadGateway, "upstream_unavailable", fmt.Sprintf("recurrence append failed: %s", err))
					return
				}
				resp.NextOccurrence = &TaskResponse{
					Page:      page,
					Text:      nextTask.Text,
					Due:       nextTask.Due,
					Deferred: nextTask.Deferred,
					Name:      nextTask.Name,
					Priority:  nextTask.Priority,
					Recur:     nextTask.Recur,
					DependsOn: nextTask.DependsOn,
				}
			} else {
				resp.RecurWarning = err.Error()
			}
		}
	}

	writeOK(w, resp)
}

func taskToResponse(tk task.Task, spaceURL string) TaskResponse {
	resp := TaskResponse{
		Page:      tk.Page,
		Position:  tk.Position,
		Text:      task.FormatWikiLinks(tk.Text, spaceURL),
		Status:    tk.Status,
		Done:      tk.Done,
		Due:       tk.Due,
		Deferred: tk.Deferred,
		Name:      tk.Name,
		Priority:  tk.Priority,
		Tags:      tk.Tags,
		Parent:    tk.Parent,
		DependsOn: tk.DependsOn,
		Blocked:    tk.Blocked,
		Recur:      tk.Recur,
		ExtraAttrs: tk.ExtraAttrs,
	}

	if tk.Due != "" {
		date, timeStr, ok := task.ParseJournalLink(tk.Due)
		if ok {
			resp.DueParsed = &DateParsed{Date: date, Time: timeStr}
		}
	}
	if tk.Deferred != "" {
		date, timeStr, ok := task.ParseJournalLink(tk.Deferred)
		if ok {
			resp.DeferredParsed = &DateParsed{Date: date, Time: timeStr}
		}
	}

	return resp
}

func tasksToResponse(tasks []task.Task, spaceURL string) []TaskResponse {
	out := make([]TaskResponse, len(tasks))
	for i, tk := range tasks {
		out[i] = taskToResponse(tk, spaceURL)
	}
	return out
}

func validateCreate(req CreateTaskRequest) error {
	if req.Text == "" {
		return fmt.Errorf("text is required")
	}
	if req.Status != "" && strings.Contains(req.Status, ":") {
		return fmt.Errorf("status must not contain ':'")
	}
	if req.Priority != "" {
		p := strings.ToLower(req.Priority)
		if p != "high" && p != "medium" && p != "low" {
			return fmt.Errorf("priority must be high, medium, or low")
		}
	}
	for _, tag := range req.Tags {
		if !task.ValidTag(tag) {
			return fmt.Errorf("invalid tag %q: must contain only word chars, hyphens, or '/' for hierarchy", tag)
		}
	}
	return nil
}

func applyModify(tk *task.Task, req *ModifyTaskRequest) error {
	if req.Text != "" {
		tk.Text = req.Text
		tk.Tags = task.ExtractTags(req.Text)
	}
	if req.Status != "" {
		tk.Status = req.Status
	}
	tk.Done = tk.Status == task.StatusDone
	if req.Due != "" {
		dateStr, err := task.ParseDate(req.Due)
		if err != nil {
			return &task.ValidationError{Field: "due", Message: err.Error()}
		}
		dp, tp := task.SplitDateTime(dateStr)
		tk.Due = task.FormatJournalLink(dp, tp)
	}
	if req.Deferred != "" {
		dateStr, err := task.ParseDate(req.Deferred)
		if err != nil {
			return &task.ValidationError{Field: "deferred", Message: err.Error()}
		}
		dp, tp := task.SplitDateTime(dateStr)
		tk.Deferred = task.FormatJournalLink(dp, tp)
	}
	if req.Name != "" {
		tk.Name = req.Name
	}
	if req.Priority != "" {
		tk.Priority = req.Priority
	}
	if len(req.Tags) > 0 {
		for _, tag := range req.Tags {
			if !task.ValidTag(tag) {
				return fmt.Errorf("invalid tag %q: must contain only word chars, hyphens, or '/' for hierarchy", tag)
			}
		}
		tk.Text = task.StripHashtags(tk.Text)
		tk.Text = task.AppendTags(tk.Text, req.Tags)
		tk.Tags = task.ExtractTags(tk.Text)
	}
	if req.DependsOn != nil {
		tk.DependsOn = *req.DependsOn
	}
	if req.Recur != "" {
		if _, _, ok := task.ParseRecurrence(req.Recur); !ok {
			return &task.ValidationError{Field: "recur", Message: fmt.Sprintf("must be daily:N, weekly:N, monthly:N, or yearly:N")}
		}
		tk.Recur = req.Recur
	}
	if req.ExtraAttrs != nil {
		tk.ExtraAttrs = req.ExtraAttrs
	}
	return nil
}

func parseStatusParam(values []string) []string {
	var out []string
	for _, v := range values {
		if strings.EqualFold(v, "all") {
			return nil
		}
		if strings.EqualFold(v, "blocked") || strings.EqualFold(v, "unblocked") {
			continue
		}
		if strings.EqualFold(v, "x") || strings.EqualFold(v, "done") {
			out = append(out, task.StatusDone)
		} else {
			out = append(out, strings.ToLower(v))
		}
	}
	return out
}

func excludeDoneAndWaiting(tasks []task.Task) []task.Task {
	out := make([]task.Task, 0, len(tasks))
	for _, tk := range tasks {
		if tk.Status == task.StatusDone || tk.Status == task.StatusWaiting {
			continue
		}
		out = append(out, tk)
	}
	return out
}

func filterNotDone(tasks []task.Task) []task.Task {
	out := make([]task.Task, 0, len(tasks))
	for _, tk := range tasks {
		if !tk.Done {
			out = append(out, tk)
		}
	}
	return out
}

func intParam(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}

func hasStatusParam(r *http.Request) bool {
	for _, v := range r.URL.Query()["status"] {
		if !strings.EqualFold(v, "blocked") && !strings.EqualFold(v, "unblocked") {
			return true
		}
	}
	return false
}

func hasBlockedStatus(r *http.Request) bool {
	for _, v := range r.URL.Query()["status"] {
		if strings.EqualFold(v, "blocked") {
			return true
		}
	}
	return false
}

func hasUnblockedStatus(r *http.Request) bool {
	for _, v := range r.URL.Query()["status"] {
		if strings.EqualFold(v, "unblocked") {
			return true
		}
	}
	return false
}

func filterBlocked(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if tk.Blocked {
			out = append(out, tk)
		}
	}
	return out
}

func filterUnblocked(tasks []task.Task) []task.Task {
	var out []task.Task
	for _, tk := range tasks {
		if !tk.Blocked {
			out = append(out, tk)
		}
	}
	return out
}

func parsePos(w http.ResponseWriter, r *http.Request) (int, bool) {
	s := r.PathValue("pos")
	pos, err := strconv.Atoi(s)
	if err != nil || pos < 1 {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid position: %s", s))
		return 0, false
	}
	return pos, true
}

func requireJSON(r *http.Request) error {
	ct := r.Header.Get("Content-Type")
	if ct != "" && !strings.HasPrefix(ct, "application/json") {
		return fmt.Errorf("Content-Type must be application/json")
	}
	return nil
}

// resolveFilePositions re-sorts tasks by their actual position in the page file,
// then renumbers positions so the API list order matches what ParseTasksFromPage
// uses in handleToggleDone / handleModifyTask.
func resolveFilePositions(tasks []task.Task, c *client.Client) []task.Task {
	// Strip attributes and hashtags from text for matching, since
	// the Runtime API's task name (used as Text in FromRuntime) is
	// clean, but ParseTasksFromPage returns raw text with attrs/tags.
	stripText := func(s string) string {
		s = task.StripHashtags(s)
		// Strip [key: "value"] attributes
		for {
			start := strings.Index(s, "[")
			if start < 0 {
				break
			}
			end := strings.Index(s[start:], "]")
			if end < 0 {
				break
			}
			if strings.Contains(s[start:start+end], ":") {
				s = s[:start] + s[start+end+1:]
			} else {
				break
			}
		}
		return strings.TrimSpace(s)
	}

	pages := make(map[string]struct{})
	for _, tk := range tasks {
		pages[tk.Page] = struct{}{}
	}

	posMap := make(map[string]int)
	for page := range pages {
		content, _, err := c.ReadPage(page)
		if err != nil || content == "" {
			continue
		}
		pageTasks, err := task.ParseTasksFromPage(content, page)
		if err != nil {
			continue
		}
		for i, pt := range pageTasks {
			key := fmt.Sprintf("%s/%s", pt.Page, stripText(pt.Text))
			posMap[key] = i + 1
		}
	}

	sort.SliceStable(tasks, func(i, j int) bool {
		pi := tasks[i].Page
		pj := tasks[j].Page
		if pi != pj {
			return pi < pj
		}
		keyI := fmt.Sprintf("%s/%s", pi, stripText(tasks[i].Text))
		keyJ := fmt.Sprintf("%s/%s", pj, stripText(tasks[j].Text))
		posI := posMap[keyI]
		posJ := posMap[keyJ]
		return posI < posJ
	})

	// Assign file positions directly from posMap rather than renumbering.
	// This ensures the position in the API response matches the file position
	// (1-indexed within the page) used by ParseTasksFromPage in handleToggleDone
	// and handleModifyTask.  Even when excludeDoneAndWaiting removes tasks,
	// the remaining tasks retain their file positions, so the done/modify
	// endpoints can look up the correct task.
	for i := range tasks {
		key := fmt.Sprintf("%s/%s", tasks[i].Page, stripText(tasks[i].Text))
		if p, ok := posMap[key]; ok {
			tasks[i].Position = p
		}
	}

	return tasks
}

func shortenTaskText(s string) string {
	const maxLen = 60
	r := []rune(s)
	if len(r) <= maxLen {
		return s
	}
	return string(r[:maxLen])
}

func validatePageName(page string) error {
	if page == "" {
		return fmt.Errorf("page name is required")
	}
	if strings.Contains(page, "..") {
		return fmt.Errorf("page name must not contain '..'")
	}
	if strings.Contains(page, "\\") {
		return fmt.Errorf("page name must not contain backslash")
	}
	return nil
}

func checkPage(w http.ResponseWriter, page string) bool {
	if err := validatePageName(page); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return false
	}
	return true
}
