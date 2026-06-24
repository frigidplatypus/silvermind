package serve

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"

	"github.com/justin/sbtask/pkg/config"
)

func newTestServer(t *testing.T, fsHandler http.HandlerFunc) (fs *httptest.Server, httpSrv *httptest.Server, srv *Server) {
	t.Helper()

	fs = httptest.NewServer(fsHandler)
	t.Cleanup(fs.Close)

	cfg := &config.ConfigFile{
		Spaces: map[string]config.SpaceConfig{
			"main": {Space: fs.URL, InboxPage: "Inbox"},
		},
		ActiveSpace: "main",
	}

	srv = NewServer(cfg, "main", fs.URL, "", "127.0.0.1", 0)
	httpSrv = httptest.NewServer(srv.Handler())
	t.Cleanup(httpSrv.Close)

	return fs, httpSrv, srv
}

func postJSON(t *testing.T, url string, body interface{}) *http.Response {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	resp, err := http.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		t.Fatalf("POST %s: %v", url, err)
	}
	return resp
}

func putJSON(t *testing.T, url string, body interface{}) *http.Response {
	t.Helper()
	data, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	req, err := http.NewRequest("PUT", url, bytes.NewReader(data))
	if err != nil {
		t.Fatalf("PUT %s: %v", url, err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PUT %s: %v", url, err)
	}
	return resp
}

func TestInboxCreate(t *testing.T) {
	var putBody string
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Inbox":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/Inbox.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "")
		case r.Method == "PUT" && r.URL.Path == "/.fs/Inbox.md":
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			w.WriteHeader(http.StatusCreated)
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := postJSON(t, httpSrv.URL+"/inbox", map[string]string{
		"text": "buy milk",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, body = %q, want 201", resp.StatusCode, body)
	}
	if !strings.Contains(putBody, "buy milk") {
		t.Errorf("put body = %q, expected to contain %q", putBody, "buy milk")
	}
}

func TestInboxCreateWithTagsAndPriority(t *testing.T) {
	var putBody string
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Inbox":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/Inbox.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "")
		case r.Method == "PUT" && r.URL.Path == "/.fs/Inbox.md":
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			w.WriteHeader(http.StatusCreated)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := postJSON(t, httpSrv.URL+"/inbox", map[string]interface{}{
		"text":     "buy milk",
		"priority": "high",
		"tags":     []string{"urgent", "shopping"},
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, body = %q, want 201", resp.StatusCode, body)
	}
	if !strings.Contains(putBody, "#urgent") || !strings.Contains(putBody, "#shopping") {
		t.Errorf("put body = %q, expected to contain #urgent and #shopping", putBody)
	}
	if !strings.Contains(putBody, "[priority: high]") {
		t.Errorf("put body = %q, expected to contain [priority: high]", putBody)
	}
}

func TestInboxCreateRejectsInvalidPriority(t *testing.T) {
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("should not have made an HTTP call, got: %s %s", r.Method, r.URL.Path)
		w.WriteHeader(http.StatusInternalServerError)
	})

	resp := postJSON(t, httpSrv.URL+"/inbox", map[string]string{
		"text":     "x",
		"priority": "banana",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestInboxCreateRejectsInvalidTag(t *testing.T) {
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("should not have made an HTTP call, got: %s %s", r.Method, r.URL.Path)
		w.WriteHeader(http.StatusInternalServerError)
	})

	resp := postJSON(t, httpSrv.URL+"/inbox", map[string]interface{}{
		"text": "x",
		"tags": []string{"with space"},
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestInboxCreateRejectsEmptyText(t *testing.T) {
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("should not have made an HTTP call")
		w.WriteHeader(http.StatusInternalServerError)
	})

	resp := postJSON(t, httpSrv.URL+"/inbox", map[string]string{"text": ""})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestModifyTask(t *testing.T) {
	var (
		mu        sync.Mutex
		page      = "- [ ] old text"
		putBody   string
		putCalled bool
	)
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, page)
		case r.Method == "PUT" && r.URL.Path == "/.fs/Tasks.md":
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			putCalled = true
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := putJSON(t, httpSrv.URL+"/tasks/1?page=Tasks", map[string]string{
		"text": "new text",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, body = %q, want 200", resp.StatusCode, body)
	}
	mu.Lock()
	defer mu.Unlock()
	if !putCalled {
		t.Fatal("expected PUT to be called")
	}
	if !strings.Contains(putBody, "new text") {
		t.Errorf("put body = %q, expected to contain %q", putBody, "new text")
	}
	if strings.Contains(putBody, "old text") {
		t.Errorf("put body = %q, should not contain %q", putBody, "old text")
	}
}

func TestModifyTaskRejectsInvalidDue(t *testing.T) {
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "- [ ] old text")
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := putJSON(t, httpSrv.URL+"/tasks/1?page=Tasks", map[string]string{
		"due": "banana",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("status = %d, body = %q, want 400", resp.StatusCode, body)
	}
}

func TestModifyTaskRejectsInvalidRecur(t *testing.T) {
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, "- [ ] old text")
		default:
			t.Errorf("unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := putJSON(t, httpSrv.URL+"/tasks/1?page=Tasks", map[string]string{
		"recur": "yearly",
	})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		_, _ = io.ReadAll(resp.Body)
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestMarkDoneWithRecurrence(t *testing.T) {
	var (
		mu      sync.Mutex
		page    = `- [ ] weekly review [due: "[[Journal/2026-06-19]]"] [recur: weekly:1]`
		putBody string
		puts    int
	)
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks":
			w.WriteHeader(http.StatusNotFound)
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, page)
		case r.Method == "PUT" && r.URL.Path == "/.fs/Tasks.md":
			body, _ := io.ReadAll(r.Body)
			putBody = string(body)
			puts++
			w.WriteHeader(http.StatusOK)
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := putJSON(t, httpSrv.URL+"/tasks/1/done?page=Tasks", map[string]string{})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, body = %q, want 200", resp.StatusCode, body)
	}

	mu.Lock()
	defer mu.Unlock()
	if puts != 2 {
		t.Errorf("expected 2 PUTs (mark done + append recurrence), got %d", puts)
	}
	if !strings.Contains(putBody, "[[Journal/2026-06-26]]") {
		t.Errorf("put body = %q, expected to contain next due date 2026-06-26", putBody)
	}
}

func TestMarkDoneRecurrenceAppendFailure(t *testing.T) {
	var (
		mu   sync.Mutex
		page = `- [ ] weekly review [due: "[[Journal/2026-06-19]]"] [recur: weekly:1]`
		puts int
	)
	_, httpSrv, _ := newTestServer(t, func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		switch {
		case r.Method == "GET" && r.URL.Path == "/.fs/Tasks.md":
			w.WriteHeader(http.StatusOK)
			io.WriteString(w, page)
		case r.Method == "PUT" && r.URL.Path == "/.fs/Tasks.md":
			puts++
			if puts == 1 {
				w.WriteHeader(http.StatusOK)
				return
			}
			w.WriteHeader(http.StatusInternalServerError)
			io.WriteString(w, "boom")
		default:
			w.WriteHeader(http.StatusInternalServerError)
		}
	})

	resp := putJSON(t, httpSrv.URL+"/tasks/1/done?page=Tasks", map[string]string{})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadGateway {
		body, _ := io.ReadAll(resp.Body)
		t.Errorf("status = %d, body = %q, want 502 (recurrence append failure)", resp.StatusCode, body)
	}
}
