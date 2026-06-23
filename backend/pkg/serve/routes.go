package serve

import "net/http"

func registerRoutes(s *Server, mux *http.ServeMux) {
	mux.HandleFunc("GET /health", s.handleHealth)
	mux.HandleFunc("GET /spaces", s.handleSpaces)
	mux.HandleFunc("GET /today", s.handleToday)
	mux.HandleFunc("GET /tasks", s.handleListTasks)
	mux.HandleFunc("GET /tasks/{page}/{pos}", s.handleGetTask)
	mux.HandleFunc("POST /inbox", s.handleCreateInbox)
	mux.HandleFunc("PUT /tasks/{page}/{pos}", s.handleModifyTask)
	mux.HandleFunc("PUT /tasks/{page}/{pos}/done", s.handleMarkDone)
	mux.HandleFunc("PUT /tasks/{page}/{pos}/undo", s.handleMarkUndone)
	mux.HandleFunc("GET /queries", s.handleQueryPages)
	mux.HandleFunc("GET /queries/{page...}", s.handleQueryBlockList)
	mux.HandleFunc("POST /queries/execute", s.handleQueryExecute)
	mux.HandleFunc("POST /queries/save", s.handleQuerySave)
	mux.HandleFunc("POST /queries/test", s.handleQueryTest)
	mux.HandleFunc("GET /helpers/check", s.handleHelpersCheck)
	mux.HandleFunc("POST /helpers/deploy", s.handleHelpersDeploy)
}
