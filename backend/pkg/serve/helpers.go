package serve

import (
	"net/http"
)

const helpersPage = "Library/Silvermind/helpers"
const helpersContent = `---
tags:
  - silvermind/helpers
  - meta/silvermind
---

# Silvermind Date Helpers

Space Lua date math functions for queries. Managed by Silvermind.

**To override a function,** define your own version with a lower
priority on any page (e.g. CONFIG.md), then run System: Reload.

` + "```space-lua" + `
-- priority: 100
function today()
  return os.date("%Y-%m-%d")
end

function tomorrow()
  return os.date("%Y-%m-%d", os.time() + 86400)
end

function monthStart()
  local t = os.date("*t")
  return os.date("%Y-%m-%d", os.time{year = t.year, month = t.month, day = 1})
end

function monthEnd()
  local t = os.date("*t")
  return os.date("%Y-%m-%d", os.time{year = t.year, month = t.month + 1, day = 0})
end

function weekStart()
  local t = os.date("*t")
  local offset = (t.wday + 5) % 7
  return os.date("%Y-%m-%d", os.time(t) - offset * 86400)
end

function weekEnd()
  local t = os.date("*t")
  local offset = (8 - t.wday) % 7
  return os.date("%Y-%m-%d", os.time(t) + offset * 86400)
end

function addDays(n)
  return os.date("%Y-%m-%d", os.time() + n * 86400)
end
` + "```" + `
`

func (s *Server) handleHelpersCheck(w http.ResponseWriter, r *http.Request) {
	c, _, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	_, _, err = c.ReadPage(helpersPage)
	writeOK(w, map[string]bool{"exists": err == nil})
}

func (s *Server) handleHelpersDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "bad_request", "method not allowed")
		return
	}

	c, _, err := s.resolveSpace(r)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal_error", err.Error())
		return
	}

	if err := c.WritePage(helpersPage, helpersContent); err != nil {
		writeError(w, http.StatusBadGateway, "upstream_unavailable", err.Error())
		return
	}

	writeOK(w, map[string]bool{"deployed": true})
}
