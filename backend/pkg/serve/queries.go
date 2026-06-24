package serve

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"

	"github.com/justin/sbtask/pkg/query"
)

const queryPageTag = "silvermind/queries"

const queryDiscoveryLua = `return query[[
from p = index.pages()
where table.includes(p.tags, "silvermind/queries")
order by p.name
]]`

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
	Errors     []string          `json:"errors,omitempty"`
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

	spaceURL := c.BaseURL()
	tag := r.URL.Query().Get("tag")
	if tag == "" {
		tag = queryPageTag
	}

	// Use the SLIQ query to discover pages (single API call, works everywhere)
	slog.Info("discovering query pages via Lua", "tag", tag, "space", spaceURL)
	raw, err := c.ExecuteLua(queryDiscoveryLua)
	if err != nil {
		slog.Error("query discovery Lua error", "error", err)
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	var discovered []map[string]interface{}
	if err := json.Unmarshal(raw, &discovered); err != nil {
		slog.Error("query discovery parse error", "error", err)
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	pageNames := make([]string, 0, len(discovered))
	for _, p := range discovered {
		if name, ok := p["name"].(string); ok && name != "" {
			pageNames = append(pageNames, name)
		}
	}
	slog.Info("discovered query pages", "count", len(pageNames))

	// Check cache, identify misses
	cacheKeyPrefix := spaceURL + "|"
	var uncached []string
	result := make([]QueryPageInfo, 0, len(pageNames))
	for _, page := range pageNames {
		cacheKey := cacheKeyPrefix + page
		if cached, ok := s.pageBlockCache.Load(cacheKey); ok {
			result = append(result, cached.(QueryPageInfo))
		} else {
			uncached = append(uncached, page)
		}
	}

	// Parallel-read uncached pages
	if len(uncached) > 0 {
		var mu sync.Mutex
		var wg sync.WaitGroup
		wg.Add(len(uncached))
		for _, page := range uncached {
			go func(p string) {
				defer wg.Done()
				content, _, err := c.ReadPage(p)
				if err != nil || content == "" {
					info := QueryPageInfo{
						Page:   p,
						Errors: []string{"Could not read page — check the page exists and is accessible."},
					}
					cacheKey := cacheKeyPrefix + p
					s.pageBlockCache.Store(cacheKey, info)
					mu.Lock()
					result = append(result, info)
					mu.Unlock()
					return
				}
				blocks := query.ExtractQueryBlocks(content)
				if len(blocks) == 0 {
					info := QueryPageInfo{
						Page:   p,
						Errors: []string{"No query blocks found — the page may use unsupported SLIQ syntax. View in SilverBullet to confirm."},
					}
					cacheKey := cacheKeyPrefix + p
					s.pageBlockCache.Store(cacheKey, info)
					mu.Lock()
					result = append(result, info)
					mu.Unlock()
					return
				}
				info := QueryPageInfo{Page: p, BlockCount: len(blocks)}
				for _, b := range blocks {
					info.Blocks = append(info.Blocks, QueryBlockInfo{
						Title:  b.Title,
						Number: b.Number,
						SLIQ:   b.SLIQ,
					})
				}
				// Store in cache and result
				cacheKey := cacheKeyPrefix + p
				s.pageBlockCache.Store(cacheKey, info)
				mu.Lock()
				result = append(result, info)
				mu.Unlock()
			}(page)
		}
		wg.Wait()
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
			writeError(w, http.StatusBadGateway, "upstream_unavailable", wrapQueryError(err).Error())
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

	// Invalidate cache for this page
	cacheKey := c.BaseURL() + "|" + req.Page
	s.pageBlockCache.Delete(cacheKey)

	writeOK(w, map[string]string{"page": req.Page})
}

func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

// wrapQueryError translates cryptic SilverBullet runtime errors into
// user-friendly messages with actionable guidance.
func wrapQueryError(err error) error {
	msg := err.Error()
	if strings.Contains(msg, "Cannot read properties of null (reading 'length')") {
		return fmt.Errorf("%s\n\nThis is a SilverBullet bug — some tasks have empty or null tags. "+
			"Edit the query in SilverMind's Query Builder and use the tag filter controls instead of "+
			"hand-editing table.includes in the SLIQ", msg)
	}
	return err
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
		writeError(w, http.StatusBadGateway, "upstream_unavailable", wrapQueryError(err).Error())
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
