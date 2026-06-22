package client

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type Config struct {
	SpaceURL  string
	AuthToken string
	Timeout   time.Duration
}

type Client struct {
	baseURL    *url.URL
	httpClient *http.Client
	authToken  string
}

func NewClient(cfg Config) (*Client, error) {
	if cfg.SpaceURL == "" {
		return nil, fmt.Errorf("space URL is required")
	}

	baseURL, err := url.Parse(cfg.SpaceURL)
	if err != nil {
		return nil, fmt.Errorf("invalid space URL %q: %w", cfg.SpaceURL, err)
	}

	timeout := cfg.Timeout
	if timeout == 0 {
		timeout = 30 * time.Second
	}

	return &Client{
		baseURL:    baseURL,
		httpClient: &http.Client{Timeout: timeout},
		authToken:  cfg.AuthToken,
	}, nil
}

func (c *Client) newRequest(method, url string, body io.Reader) (*http.Request, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	if c.authToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.authToken)
	}
	return req, nil
}

func (c *Client) BaseURL() string {
	return c.baseURL.String()
}

func (c *Client) HTTPClient() *http.Client {
	return c.httpClient
}

func (c *Client) resolveURL(path string) string {
	return c.baseURL.JoinPath(path).String()
}
