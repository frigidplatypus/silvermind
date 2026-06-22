package client

import "fmt"

type APIError struct {
	StatusCode int
	Code       string
	Message    string
}

func (e *APIError) Error() string {
	if e.Code != "" {
		return fmt.Sprintf("API error %d (%s): %s", e.StatusCode, e.Code, e.Message)
	}
	return fmt.Sprintf("API error %d: %s", e.StatusCode, e.Message)
}

func ErrUnreachable(url string, cause error) error {
	return fmt.Errorf("SilverBullet at %s is unreachable: %w", url, cause)
}

func ErrTimeout(url string) error {
	return fmt.Errorf("request to SilverBullet at %s timed out", url)
}

func ErrUnexpectedStatus(code int, body string) error {
	return fmt.Errorf("unexpected status %d: %s", code, body)
}
