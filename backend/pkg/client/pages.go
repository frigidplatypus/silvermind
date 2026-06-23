package client

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
)

type RuntimePage struct {
	Ref          string   `json:"ref"`
	Name         string   `json:"name"`
	Tags         []string `json:"tags"`
	ITags        []string `json:"itags,omitempty"`
	LastModified string   `json:"lastModified,omitempty"`
}

// FindPagesByTag returns all page names that have the given tag in their frontmatter.
// Attempts server-side filtering first (works on most SilverBullet instances),
// then falls back to client-side filtering with a generous limit.
func (c *Client) FindPagesByTag(tag string) ([]string, error) {
	// Fast path: server-side tag query (works on most instances)
	if names, err := c.findPagesByTagServer(tag); err == nil && len(names) > 0 {
		return names, nil
	}

	// Fallback: fetch all pages and filter client-side
	u := c.resolveURL("/.runtime/objects/page")
	q := url.Values{}
	q.Set("limit", "1000")
	u += "?" + q.Encode()

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

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Error string `json:"error"`
			Code  string `json:"code"`
		}
		json.Unmarshal(body, &apiErr)
		log.Printf("[FindPagesByTag] HTTP %d from %s: %s", resp.StatusCode, u, string(body))
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Code:       apiErr.Code,
			Message:    apiErr.Error,
		}
	}

	var pages []RuntimePage
	if err := json.Unmarshal(body, &pages); err != nil {
		return nil, fmt.Errorf("failed to parse page response: %w", err)
	}

	names := make([]string, 0, len(pages))
	for _, p := range pages {
		if hasTag(p, tag) {
			names = append(names, p.Name)
		}
	}
	return names, nil
}

func (c *Client) findPagesByTagServer(tag string) ([]string, error) {
	u := c.resolveURL("/.runtime/objects/page")
	q := url.Values{}
	q.Set("where[tags][contains]", tag)
	q.Set("limit", "100")
	u += "?" + q.Encode()

	req, err := c.newRequest("GET", u, nil)
	if err != nil {
		return nil, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("server tag query failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var pages []RuntimePage
	if err := json.Unmarshal(body, &pages); err != nil {
		return nil, err
	}

	if len(pages) == 0 {
		return nil, fmt.Errorf("no results")
	}

	names := make([]string, 0, len(pages))
	for _, p := range pages {
		names = append(names, p.Name)
	}
	return names, nil
}

func hasTag(p RuntimePage, tag string) bool {
	for _, t := range p.Tags {
		if t == tag {
			return true
		}
	}
	for _, t := range p.ITags {
		if t == tag {
			return true
		}
	}
	return false
}