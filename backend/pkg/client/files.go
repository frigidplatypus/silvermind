package client

import (
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
)

var ErrPreconditionFailed = errors.New("precondition failed: the page has been modified since it was read")

func (c *Client) ReadPage(path string) (content string, lastModified int64, err error) {
	content, lastModified, err = c.readPageRaw(path)
	if err == nil && content == "" && !strings.HasSuffix(path, ".md") {
		return c.readPageRaw(path + ".md")
	}
	return
}

func (c *Client) readPageRaw(path string) (string, int64, error) {
	u := c.resolveURL("/.fs/" + strings.TrimPrefix(path, "/"))

	var lastModified int64

	req, err := c.newRequest("GET", u, nil)
	if err != nil {
		return "", 0, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", 0, ErrUnreachable(c.baseURL.String(), err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", 0, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode == http.StatusNotFound {
		return "", 0, nil
	}

	if resp.StatusCode != http.StatusOK {
		return "", 0, ErrUnexpectedStatus(resp.StatusCode, string(body))
	}

	if lm := resp.Header.Get("X-Last-Modified"); lm != "" {
		lastModified, err = strconv.ParseInt(lm, 10, 64)
		if err != nil {
			slog.Warn("malformed X-Last-Modified header, optimistic locking disabled", "value", lm)
			lastModified = 0
		}
	}

	return string(body), lastModified, nil
}

func (c *Client) WritePage(path string, content string) error {
	return c.writePageConditional(path, content, 0)
}

func (c *Client) writePageConditional(path string, content string, lastModified int64) error {
	if !strings.HasSuffix(path, ".md") {
		path = path + ".md"
	}
	u := c.resolveURL("/.fs/" + strings.TrimPrefix(path, "/"))

	req, err := c.newRequest("PUT", u, strings.NewReader(content))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "text/markdown")
	if lastModified > 0 {
		req.Header.Set("If-Match", strconv.FormatInt(lastModified, 10))
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return ErrUnreachable(c.baseURL.String(), err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusPreconditionFailed {
		return ErrPreconditionFailed
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return ErrUnexpectedStatus(resp.StatusCode, string(body))
	}

	return nil
}

func (c *Client) ReadModifyWrite(page string, fn func(string) (string, error)) error {
	for retries := 0; retries < 10; retries++ {
		content, lastModified, err := c.ReadPage(page)
		if err != nil {
			return err
		}

		newContent, err := fn(content)
		if err != nil {
			return err
		}
		if newContent == content {
			return nil
		}

		err = c.writePageConditional(page, newContent, lastModified)
		if err == nil {
			return nil
		}
		if !errors.Is(err, ErrPreconditionFailed) {
			return err
		}
	}
	return fmt.Errorf("too many conflicts writing page %s", page)
}

func (c *Client) AppendTask(page string, taskLine string) error {
	return c.ReadModifyWrite(page, func(content string) (string, error) {
		if content == "" {
			return taskLine + "\n", nil
		}
		if !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		return content + taskLine + "\n", nil
	})
}
