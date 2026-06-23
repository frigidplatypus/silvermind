package serve

import (
	"net/http"
	"os"

	"github.com/justin/sbtask/pkg/client"
	"github.com/justin/sbtask/pkg/config"
)

type configStatusResponse struct {
	Exists       bool                `json:"exists"`
	SbtaskExists bool                `json:"sbtask_exists"`
	SpaceCount   int                 `json:"space_count"`
	Spaces       []configSpaceInfo   `json:"spaces"`
}

type configSpaceInfo struct {
	Name    string `json:"name"`
	URL     string `json:"url"`
	Default bool   `json:"default"`
}

type spaceVerifyRequest struct {
	URL       string `json:"url"`
	AuthToken string `json:"auth_token,omitempty"`
}

type spaceVerifyResponse struct {
	OK        bool   `json:"ok"`
	TaskCount int    `json:"task_count,omitempty"`
	Error     string `json:"error,omitempty"`
}

func (s *Server) handleConfigStatus(w http.ResponseWriter, r *http.Request) {
	resp := configStatusResponse{Exists: true}

	if s.cfg != nil {
		resp.SpaceCount = len(s.cfg.Spaces)
		for name, sc := range s.cfg.Spaces {
			resp.Spaces = append(resp.Spaces, configSpaceInfo{
				Name:    name,
				URL:     sc.Space,
				Default: name == s.cfg.ActiveSpace,
			})
		}
	}

	sbtaskPath := config.DefaultConfigPath()
	if _, err := os.ReadFile(sbtaskPath); err == nil {
		resp.SbtaskExists = true
		if !resp.Exists {
			sbtaskCfg, err := config.LoadConfig(sbtaskPath)
			if err == nil && sbtaskCfg != nil {
				for name, sc := range sbtaskCfg.Spaces {
					resp.Spaces = append(resp.Spaces, configSpaceInfo{
						Name:    name,
						URL:     sc.Space,
						Default: name == sbtaskCfg.ActiveSpace,
					})
				}
				resp.SpaceCount = len(sbtaskCfg.Spaces)
			}
		}
	}

	writeOK(w, resp)
}

func (s *Server) handleSpacesVerify(w http.ResponseWriter, r *http.Request) {
	req, err := decodeJSON[spaceVerifyRequest](r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "bad_request", "invalid JSON")
		return
	}
	if req.URL == "" {
		writeError(w, http.StatusBadRequest, "bad_request", "url is required")
		return
	}

	c, err := client.NewClient(client.Config{SpaceURL: req.URL, AuthToken: req.AuthToken})
	if err != nil {
		writeOK(w, spaceVerifyResponse{OK: false, Error: err.Error()})
		return
	}

	tasks, apiErr := c.QueryTasks(map[string]string{"limit": "1"})
	if apiErr != nil {
		writeOK(w, spaceVerifyResponse{OK: false, Error: apiErr.Error()})
		return
	}

	writeOK(w, spaceVerifyResponse{OK: true, TaskCount: len(tasks)})
}
