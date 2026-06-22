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
// Uses SilverBullet's Runtime API to query page objects.
func (c *Client) FindPagesByTag(tag string) ([]string, error) {
	u := c.resolveURL("/.runtime/objects/page")
	q := url.Values{}
	q.Set("where[tags][contains]", tag)
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
		names = append(names, p.Name)
	}
	return names, nil
}

