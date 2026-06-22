package client

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"testing"
)

func TestReadPageReturnsContent(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/.fs/page.md" {
			w.Header().Set("X-Last-Modified", "12345")
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "# heading\n- [ ] task 1\n")
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c, err := NewClient(Config{SpaceURL: srv.URL})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}

	content, lastModified, err := c.ReadPage("page")
	if err != nil {
		t.Fatalf("ReadPage: %v", err)
	}
	if !strings.Contains(content, "task 1") {
		t.Errorf("content = %q, expected to contain %q", content, "task 1")
	}
	if lastModified != 12345 {
		t.Errorf("lastModified = %d, want 12345", lastModified)
	}
}

func TestReadPageFallsBackToMD(t *testing.T) {
	var tried string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tried = r.URL.Path
		if r.URL.Path == "/.fs/page.md" {
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "content")
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	c, _ := NewClient(Config{SpaceURL: srv.URL})
	content, _, err := c.ReadPage("page")
	if err != nil {
		t.Fatalf("ReadPage: %v", err)
	}
	if content != "content" {
		t.Errorf("content = %q, want %q", content, "content")
	}
	if !strings.HasSuffix(tried, "/.fs/page.md") {
		t.Errorf("tried path = %q, want suffix %q", tried, "/.fs/page.md")
	}
}

func TestAppendTaskCreatesNewPage(t *testing.T) {
	var putBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && (r.URL.Path == "/.fs/page" || r.URL.Path == "/.fs/page.md"):
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "PUT" && r.URL.Path == "/.fs/page.md":
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	c, _ := NewClient(Config{SpaceURL: srv.URL})
	if err := c.AppendTask("page", "- [ ] new task"); err != nil {
		t.Fatalf("AppendTask: %v", err)
	}
	if putBody != "- [ ] new task\n" {
		t.Errorf("PUT body = %q, want %q", putBody, "- [ ] new task\n")
	}
}

func TestAppendTaskAppendsToExistingPage(t *testing.T) {
	var putBody string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/page":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/page.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "- [ ] existing task")
		case r.Method == "PUT" && r.URL.Path == "/.fs/page.md":
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	c, _ := NewClient(Config{SpaceURL: srv.URL})
	if err := c.AppendTask("page", "- [ ] new task"); err != nil {
		t.Fatalf("AppendTask: %v", err)
	}
	want := "- [ ] existing task\n- [ ] new task\n"
	if putBody != want {
		t.Errorf("PUT body = %q, want %q", putBody, want)
	}
}

func TestAppendTaskConcurrentWithIfMatch(t *testing.T) {
	var (
		mu           sync.Mutex
		content      = "- [ ] existing task\n"
		lastModified int64 = 1000
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.Method == "GET" && (r.URL.Path == "/.fs/page" || r.URL.Path == "/.fs/page.md"):
			w.Header().Set("X-Last-Modified", strconv.FormatInt(lastModified, 10))
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, content)
		case r.Method == "PUT" && r.URL.Path == "/.fs/page.md":
			ifMatch := r.Header.Get("If-Match")
			if ifMatch != "" {
				lm, err := strconv.ParseInt(ifMatch, 10, 64)
				if err != nil || lm != lastModified {
					w.WriteHeader(http.StatusPreconditionFailed)
					return
				}
			}
			body, _ := io.ReadAll(r.Body)
			content = string(body)
			lastModified++
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	c, _ := NewClient(Config{SpaceURL: srv.URL})
	var wg sync.WaitGroup
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			line := "- [ ] task " + string(rune('a'+i))
			c.AppendTask("page", line)
		}(i)
	}
	wg.Wait()

	mu.Lock()
	defer mu.Unlock()
	count := 0
	for _, ch := range "abcde" {
		if strings.Contains(content, "- [ ] task "+string(ch)) {
			count++
		}
	}
	if count != 5 {
		t.Errorf("concurrent AppendTask: got %d/5 tasks persisted, want 5 (If-Match should prevent races)", count)
	}
}

func TestWritePageConditionalRejectsStaleIfMatch(t *testing.T) {
	var (
		mu           sync.Mutex
		content      = "original"
		lastModified int64 = 100
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/page.md":
			w.Header().Set("X-Last-Modified", strconv.FormatInt(lastModified, 10))
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, content)
		case r.Method == "PUT" && r.URL.Path == "/.fs/page.md":
			ifMatch := r.Header.Get("If-Match")
			if ifMatch != "" {
				lm, err := strconv.ParseInt(ifMatch, 10, 64)
				if err != nil || lm != lastModified {
					w.WriteHeader(http.StatusPreconditionFailed)
					return
				}
			}
			body, _ := io.ReadAll(r.Body)
			content = string(body)
			lastModified++
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	}))
	defer srv.Close()

	c, _ := NewClient(Config{SpaceURL: srv.URL})

	err := c.ReadModifyWrite("page.md", func(s string) (string, error) {
		if s != "original" {
			t.Fatalf("unexpected content: %q", s)
		}
		return s + "\n- [ ] added", nil
	})
	if err != nil {
		t.Fatalf("ReadModifyWrite: %v", err)
	}

	// Second write with stale lastModified should retry and succeed
	err = c.ReadModifyWrite("page.md", func(s string) (string, error) {
		return s + "\n- [ ] another", nil
	})
	if err != nil {
		t.Fatalf("second ReadModifyWrite: %v", err)
	}

	mu.Lock()
	defer mu.Unlock()
	if !strings.Contains(content, "another") {
		t.Errorf("final content = %q, want it to contain %q", content, "another")
	}
}

func TestWritePageSetsContentType(t *testing.T) {
	var gotType string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotType = r.Header.Get("Content-Type")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	c, _ := NewClient(Config{SpaceURL: srv.URL})
	if err := c.WritePage("page", "content"); err != nil {
		t.Fatalf("WritePage: %v", err)
	}
	if gotType != "text/markdown" {
		t.Errorf("Content-Type = %q, want %q", gotType, "text/markdown")
	}
}
