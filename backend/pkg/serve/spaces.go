package serve

import (
	"fmt"
	"net/http"

	"github.com/justin/sbtask/pkg/config"
)

type spaceRequest struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	DefaultPage string `json:"default_page,omitempty"`
	InboxPage   string `json:"inbox_page,omitempty"`
	AuthToken   string `json:"auth_token,omitempty"`
}

func (s *Server) handleSpacesAdd(w http.ResponseWriter, r *http.Request) {
	req, err := decodeJSON[spaceRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON")
		return
	}
	if req.Name == "" || req.URL == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name and url are required")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.cfg.Spaces == nil {
		s.cfg.Spaces = make(map[string]config.SpaceConfig)
	}
	s.cfg.Spaces[req.Name] = config.SpaceConfig{
		Space:       req.URL,
		AuthToken:   req.AuthToken,
		DefaultPage: firstString(req.DefaultPage, "Tasks"),
		InboxPage:   firstString(req.InboxPage, "Inbox"),
	}
	if s.cfg.ActiveSpace == "" {
		s.cfg.ActiveSpace = req.Name
	}

	if err := s.saveConfig(); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	writeOK(w, map[string]string{"status": "added", "name": req.Name})
}

func (s *Server) handleSpacesUpdate(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name is required")
		return
	}

	req, err := decodeJSON[spaceRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	sc, ok := s.cfg.Spaces[name]
	if !ok {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("space %q not found", name))
		return
	}

	if req.URL != "" {
		sc.Space = req.URL
	}
	if req.AuthToken != "" {
		sc.AuthToken = req.AuthToken
	}
	if req.DefaultPage != "" {
		sc.DefaultPage = req.DefaultPage
	}
	if req.InboxPage != "" {
		sc.InboxPage = req.InboxPage
	}
	s.cfg.Spaces[name] = sc

	if err := s.saveConfig(); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	writeOK(w, map[string]string{"status": "updated", "name": name})
}

func (s *Server) handleSpacesRemove(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("name")
	if name == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name is required")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.cfg.Spaces[name]; !ok {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("space %q not found", name))
		return
	}

	delete(s.cfg.Spaces, name)

	if s.cfg.ActiveSpace == name {
		s.cfg.ActiveSpace = ""
		for n := range s.cfg.Spaces {
			s.cfg.ActiveSpace = n
			break
		}
	}

	if err := s.saveConfig(); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	writeOK(w, map[string]string{"status": "removed", "name": name})
}

type setActiveRequest struct {
	Name string `json:"name"`
}

func (s *Server) handleSpacesSetActive(w http.ResponseWriter, r *http.Request) {
	req, err := decodeJSON[setActiveRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "name is required")
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.cfg.Spaces[req.Name]; !ok {
		writeError(w, http.StatusNotFound, "not_found", fmt.Sprintf("space %q not found", req.Name))
		return
	}

	s.cfg.ActiveSpace = req.Name

	if err := s.saveConfig(); err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	writeOK(w, map[string]string{"status": "active_set", "name": req.Name})
}

func (s *Server) saveConfig() error {
	if s.configPath == "" {
		return fmt.Errorf("no config path set")
	}
	return config.SaveConfig(s.configPath, s.cfg)
}

func firstString(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
