package client

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
)

type RuntimeTask struct {
	Ref    string   `json:"ref"`
	Tag    string   `json:"tag"`
	Name   string   `json:"name"`
	Done   bool     `json:"done"`
	State  string   `json:"state"`
	Page   string   `json:"page"`
	Pos    int      `json:"pos"`
	Parent string   `json:"parent,omitempty"`
	Tags   []string `json:"tags,omitempty"`
	ITags  []string `json:"itags,omitempty"`
	Extra  map[string]json.RawMessage `json:"-"`
}

// rawTask captures all JSON fields including unknown ones for extra_attrs extraction
type rawTask struct {
	RuntimeTask
	Extra map[string]json.RawMessage `json:"-"`
}

func (r *rawTask) UnmarshalJSON(data []byte) error {
	var m map[string]json.RawMessage
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}

	known := map[string]bool{
		"ref": true, "tag": true, "name": true, "done": true,
		"state": true, "page": true, "pos": true,
		"parent": true, "tags": true, "itags": true,
	}

	r.Extra = make(map[string]json.RawMessage)
	for k, v := range m {
		if !known[k] {
			r.Extra[k] = v
		}
	}

	return json.Unmarshal(data, &r.RuntimeTask)
}

func (c *Client) QueryTasks(params map[string]string) ([]RuntimeTask, error) {
	u := c.resolveURL("/.runtime/objects/task")
	if len(params) > 0 {
		q := url.Values{}
		for k, v := range params {
			q.Set(k, v)
		}
		u += "?" + q.Encode()
	}

	req, err := c.newRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, ErrUnreachable(c.baseURL.String(), err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == 503 {
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Code:       "bridge_unavailable",
			Message:    "Runtime API unavailable. Ensure SilverBullet is running the runtime-api Docker variant. See https://silverbullet.md/Runtime%20API for setup instructions.",
		}
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Error string `json:"error"`
			Code  string `json:"code"`
		}
		json.Unmarshal(body, &apiErr)
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Code:       apiErr.Code,
			Message:    apiErr.Error,
		}
	}

	// Unmarshal into rawTask to capture extra fields, then convert
	var rawTasks []rawTask
	if err := json.Unmarshal(body, &rawTasks); err != nil {
		return nil, fmt.Errorf("failed to parse task response: %w", err)
	}

	tasks := make([]RuntimeTask, len(rawTasks))
	for i, r := range rawTasks {
		tasks[i] = r.RuntimeTask
		tasks[i].Extra = r.Extra
	}

	return tasks, nil
}

func (c *Client) GetTask(ref string) (*RuntimeTask, error) {
	u := c.resolveURL("/.runtime/objects/task/" + url.PathEscape(ref))

	req, err := c.newRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, ErrUnreachable(c.baseURL.String(), err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, nil
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, ErrUnexpectedStatus(resp.StatusCode, string(body))
	}

	var task RuntimeTask
	if err := json.Unmarshal(body, &task); err != nil {
		return nil, fmt.Errorf("failed to parse task: %w", err)
	}

	return &task, nil
}

func (c *Client) ExecuteLua(script string) (json.RawMessage, error) {
	u := c.resolveURL("/.runtime/lua_script")

	req, err := c.newRequest("POST", u, strings.NewReader(script))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "text/plain")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, ErrUnreachable(c.baseURL.String(), err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == 503 {
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Code:       "bridge_unavailable",
			Message:    "Runtime API unavailable. Ensure SilverBullet is running the runtime-api Docker variant.",
		}
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Error string `json:"error"`
		}
		json.Unmarshal(body, &apiErr)
		msg := apiErr.Error
		if msg == "" {
			msg = string(body)
		}
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Code:       "lua_error",
			Message:    msg,
		}
	}

	var result struct {
		Result json.RawMessage `json:"result"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse Lua result: %w", err)
	}

	return result.Result, nil
}
