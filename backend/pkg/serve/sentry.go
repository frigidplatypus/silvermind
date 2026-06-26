package serve

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"runtime/debug"
	"time"

	"github.com/getsentry/sentry-go"
)

func initSentry() {
	dsn := os.Getenv("SBTASK_SENTRY_DSN")
	if dsn == "" {
		dsn = os.Getenv("SENTRY_DSN")
	}
	if dsn == "" {
		slog.Debug("sentry disabled — set SBTASK_SENTRY_DSN to enable error reporting")
		return
	}

	err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      "production",
		Release:          "sbtask@0.1.0",
		EnableTracing:    false,
		AttachStacktrace: true,
	})
	if err != nil {
		slog.Error("sentry init failed", "error", err)
		return
	}
	slog.Info("sentry enabled", "release", "sbtask@0.1.0")
}

func sentryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				hub := sentry.CurrentHub().Clone()
				hub.Recover(rec)
				hub.Flush(2 * time.Second)
				debug.PrintStack()
				http.Error(w, `{"error":"internal server error","code":"internal_error"}`, http.StatusInternalServerError)
			}
		}()

		hub := sentry.CurrentHub().Clone()
		hub.Scope().SetRequest(r)
		ctx := sentry.SetHubOnContext(r.Context(), hub)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// handleReportError receives error reports from the browser frontend.
func handleReportError(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var payload struct {
		Message      string          `json:"message"`
		Stack        string          `json:"stack,omitempty"`
		Tags         map[string]string `json:"tags,omitempty"`
		Level        string          `json:"level"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		slog.Warn("invalid error report payload", "error", err)
		writeOK(w, map[string]string{"status": "received"})
		return
	}

	hub := sentry.CurrentHub().Clone()
	switch payload.Level {
	case "warning":
		hub.ConfigureScope(func(scope *sentry.Scope) { scope.SetLevel(sentry.LevelWarning) })
	case "error", "":
		hub.ConfigureScope(func(scope *sentry.Scope) { scope.SetLevel(sentry.LevelError) })
	default:
		hub.ConfigureScope(func(scope *sentry.Scope) { scope.SetLevel(sentry.LevelInfo) })
	}

	if payload.Tags != nil {
		hub.ConfigureScope(func(scope *sentry.Scope) {
			for k, v := range payload.Tags {
				scope.SetTag(k, v)
			}
		})
	}

	event := sentry.NewEvent()
	event.Message = fmt.Sprintf("[browser] %s", payload.Message)

	if payload.Stack != "" {
		event.Threads = []sentry.Thread{{
			Stacktrace: &sentry.Stacktrace{Frames: parseBrowserStack(payload.Stack)},
			Current:    true,
		}}
	}

	hub.CaptureEvent(event)
	hub.Flush(2 * time.Second)

	slog.Debug("browser error reported", "message", payload.Message)
	writeOK(w, map[string]string{"status": "received"})
}

func parseBrowserStack(stack string) []sentry.Frame {
	var frames []sentry.Frame
	lines := splitLines(stack)
	for i := len(lines) - 1; i >= 0; i-- {
		frames = append(frames, sentry.Frame{
			Function: lines[i],
		})
	}
	return frames
}

func splitLines(s string) []string {
	var lines []string
	var current []byte
	for i := 0; i < len(s); i++ {
		if s[i] == '\n' {
			if len(current) > 0 {
				lines = append(lines, string(current))
				current = nil
			}
		} else {
			current = append(current, s[i])
		}
	}
	if len(current) > 0 {
		lines = append(lines, string(current))
	}
	return lines
}
