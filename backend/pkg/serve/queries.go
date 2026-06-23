package serve

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/justin/sbtask/pkg/query"
)

const queryPageTag = "silvermind/queries"

// QueryBlockInfo is a lightweight summary of a query block on a page.
type QueryBlockInfo struct {
	Title  string `json:"title"`
	Number int    `json:"number"`
	SLIQ   string `json:"sliq"`
}

// QueryPageInfo describes a page that contains query blocks.
type QueryPageInfo struct {
	Page       string            `json:"page"`
	BlockCount int               `json:"block_count"`
	Blocks     []QueryBlockInfo  `json:"blocks,omitempty"`
}

// QueryExecuteRequest is the JSON body for the queries/execute endpoint.
type QueryExecuteRequest struct {
	Page  string `json:"page"`
	Index int    `json:"index,omitempty"`
	Name  string `json:"name,omitempty"`
}

// QueryExecuteResponse is a single query block result.
type QueryExecuteResponse struct {
	Title string          `json:"title"`
	SLIQ  string          `json:"sliq,omitempty"`
	Tasks []TaskResponse  `json:"tasks"`
}

func (s *Server) handleQueryPages(w http.ResponseWriter, r *http.Request) {
	c, _, err := s.resolveSpace(r)
	if err != nil {
		slog.Error("queries resolveSpace error", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	tag := r.URL.Query().Get("tag")
	if tag == "" {
		tag = queryPageTag
	}

	slog.Info("searching for query pages", "tag", tag, "space", c.BaseURL())
	pages, err := c.FindPagesByTag(tag)
	if err != nil {
		slog.Error("queries FindPagesByTag error", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}
	slog.Info("found query pages", "count", len(pages), "tag", tag)

	result := make([]QueryPageInfo, 0, len(pages))
	for _, page := range pages {
		content, _, err := c.ReadPage(page)
		if err != nil {
			continue
		}
		blocks := query.ExtractQueryBlocks(content)
		if len(blocks) == 0 {
			continue
		}
		info := QueryPageInfo{
			Page:       page,
			BlockCount: len(blocks),
		}
		for _, b := range blocks {
			info.Blocks = append(info.Blocks, QueryBlockInfo{
				Title:  b.Title,
				Number: b.Number,
				SLIQ:   b.SLIQ,
			})
		}
		result = append(result, info)
	}

	writeOK(w, result)
}

func (s *Server) handleQueryBlockList(w http.ResponseWriter, r *http.Request) {
	c, _, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	page := r.PathValue("page")
	if !checkPage(w, page) {
		return
	}
	content, _, err := c.ReadPage(page)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}
	if content == "" {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("page %s not found", page))
		return
	}

	blocks := query.ExtractQueryBlocks(content)
	if len(blocks) == 0 {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("no queries found on page %s", page))
		return
	}

	infos := make([]QueryBlockInfo, len(blocks))
	for i, b := range blocks {
		infos[i] = QueryBlockInfo{Title: b.Title, Number: b.Number, SLIQ: b.SLIQ}
	}
	writeOK(w, infos)
}

func (s *Server) handleQueryExecute(w http.ResponseWriter, r *http.Request) {
	if err := requireJSON(r); err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "bad_request", err.Error())
		return
	}

	req, err := decodeJSON[QueryExecuteRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid JSON: %s", err))
		return
	}

	if req.Page == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "page is required")
		return
	}
	if err := validatePageName(req.Page); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	content, _, err := c.ReadPage(req.Page)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}
	if content == "" {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("page %s not found", req.Page))
		return
	}

	blocks := query.ExtractQueryBlocks(content)
	if len(blocks) == 0 {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("no queries found on page %s", req.Page))
		return
	}

	var selected []query.QueryBlock
	if req.Index > 0 {
		for _, b := range blocks {
			if b.Number == req.Index {
				selected = append(selected, b)
				break
			}
		}
		if len(selected) == 0 {
			writeError(w, http.StatusNotFound, "not_found",
				fmt.Sprintf("query #%d not found on page %s (1-%d available)", req.Index, req.Page, len(blocks)))
			return
		}
	} else if req.Name != "" {
		nameLower := req.Name
		for _, b := range blocks {
			if containsFold(b.Title, nameLower) {
				selected = append(selected, b)
			}
		}
		if len(selected) == 0 {
			writeError(w, http.StatusNotFound, "not_found",
				fmt.Sprintf("no heading matching %q found on page %s", req.Name, req.Page))
			return
		}
	} else {
		selected = blocks
	}

	q := query.NewQuery(c)
	results := make([]QueryExecuteResponse, 0, len(selected))

	for _, b := range selected {
		filter, postFilter := query.TranslateSLIQ(b.SLIQ)
		tasks, err := q.Execute(filter)
		if err != nil {
			writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
			return
		}
		if postFilter != nil {
			tasks = postFilter(tasks)
		}
		resp := QueryExecuteResponse{
			Title: b.Title,
			Tasks: tasksToResponse(tasks, sc.Space),
		}
		if len(selected) == 1 {
			resp.SLIQ = b.SLIQ
		}
		results = append(results, resp)
	}

	writeOK(w, results)
}

type QuerySaveRequest struct {
	Page        string `json:"page"`
	Title       string `json:"title"`
	SLIQ        string `json:"sliq"`
	Create      bool   `json:"create"`
	BlockNumber int    `json:"block_number"`
}

func (s *Server) handleQuerySave(w http.ResponseWriter, r *http.Request) {
	if err := requireJSON(r); err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "bad_request", err.Error())
		return
	}

	req, err := decodeJSON[QuerySaveRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid JSON: %s", err))
		return
	}

	if req.Page == "" || req.Title == "" || req.SLIQ == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "page, title, and sliq are required")
		return
	}
	if err := validatePageName(req.Page); err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	c, _, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	block := fmt.Sprintf("\n## %s\n${query[[\n%s\n]]}\n", req.Title, req.SLIQ)

	if req.Create {
		pageContent := fmt.Sprintf("---\ntags:\n  - %s\n---\n%s", queryPageTag, block)
		err = c.WritePage(req.Page, pageContent)
	} else if req.BlockNumber > 0 {
		err = c.ReadModifyWrite(req.Page, func(content string) (string, error) {
			return query.ReplaceQueryBlock(content, req.BlockNumber, req.Title, req.SLIQ)
		})
	} else {
		err = c.ReadModifyWrite(req.Page, func(content string) (string, error) {
			return content + block, nil
		})
	}

	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	writeOK(w, map[string]string{"page": req.Page})
}

func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

type QueryTestRequest struct {
	SLIQ string `json:"sliq"`
}

func (s *Server) handleQueryTest(w http.ResponseWriter, r *http.Request) {
	if err := requireJSON(r); err != nil {
		writeError(w, http.StatusUnsupportedMediaType, "bad_request", err.Error())
		return
	}

	req, err := decodeJSON[QueryTestRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", fmt.Sprintf("invalid JSON: %s", err))
		return
	}

	if req.SLIQ == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "sliq is required")
		return
	}

	c, sc, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	filter, postFilter := query.TranslateSLIQ(req.SLIQ)
	q := query.NewQuery(c)
	tasks, err := q.Execute(filter)
	if err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}
	if postFilter != nil {
		tasks = postFilter(tasks)
	}

	resp := QueryExecuteResponse{
		Title: "Test Query",
		Tasks: tasksToResponse(tasks, sc.Space),
		SLIQ:  req.SLIQ,
	}
	writeOK(w, resp)
}
