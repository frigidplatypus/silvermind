package serve

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"sync"
	"time"

	"github.com/justin/sbtask/pkg/config"
)

type Server struct {
	httpServer     *http.Server
	cfg            *config.ConfigFile
	configPath     string
	spaceName      string
	spaceURL       string
	defaultPage    string
	mux            *http.ServeMux
	pageBlockCache sync.Map
	mu             sync.Mutex
}

func NewServer(cfg *config.ConfigFile, configPath, spaceName, spaceURL, defaultPage, host string, port int) *Server {
	mux := http.NewServeMux()

	s := &Server{
		cfg:        cfg,
		configPath: configPath,
		spaceName:  spaceName,
		spaceURL:   spaceURL,
		defaultPage: defaultPage,
		mux:        mux,
	}

	registerRoutes(s, mux)

	var h http.Handler = mux
	h = corsMiddleware(h)
	h = loggingMiddleware(h)
	h = recoveryMiddleware(h)
	h = limitBodySizeMiddleware(1 << 20)(h) // 1MB

	addr := fmt.Sprintf("%s:%d", host, port)

	s.httpServer = &http.Server{
		Addr:    addr,
		Handler: h,
	}

	return s
}

func (s *Server) Start() error {
	slog.Info("server starting", "addr", s.httpServer.Addr)
	return s.httpServer.ListenAndServe()
}

func (s *Server) Run() error {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	go func() {
		if err := s.Start(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	sc, err := config.ResolveSpace(s.cfg, s.spaceName, s.spaceURL)
	spaceInfo := "unknown"
	if err == nil {
		spaceInfo = sc.Space
	}

	slog.Info("sbtask serve running", "addr", s.httpServer.Addr, "space", spaceInfo)

	<-ctx.Done()
	slog.Info("shutting down...")
	return s.Shutdown()
}

func (s *Server) Shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) SetWebGUI(webGUIPath string) {
	if webGUIPath == "" {
		return
	}
	fileServer := http.FileServer(http.Dir(webGUIPath))
	s.mux.Handle("GET /", spaFallback(fileServer, webGUIPath))
}

// spaFallback wraps an http.Handler so that any 404 (missing file) serves
// index.html instead — required for SPAs with client-side routing.
func spaFallback(next http.Handler, webGUIPath string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := filepath.Join(webGUIPath, r.URL.Path)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.ServeFile(w, r, filepath.Join(webGUIPath, "index.html"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (s *Server) Addr() string {
	return s.httpServer.Addr
}

func (s *Server) Handler() http.Handler {
	return s.httpServer.Handler
}
