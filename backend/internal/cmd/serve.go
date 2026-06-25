package cmd

import (
	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/config"
	"github.com/justin/sbtask/pkg/serve"
)

var (
	serveHost   string
	servePort   int
	serveWebGUI string
)

var serveCmd = &cobra.Command{
	Use:   "serve",
	Short: "Start the sbtask HTTP API server",
	Long: `Start an HTTP server exposing all task operations as JSON endpoints.

The server runs in the foreground (no daemon) and binds to localhost:9876
by default. All sbtask CLI operations are available as REST endpoints.
No authentication is required — intended for localhost use only.

Endpoints:
  GET  /tasks                  List tasks with optional filters
  GET  /tasks/:page/:pos       Get a single task
  GET  /today                  Show today's task landscape
  POST /inbox                  Quick-capture a task to inbox
  PUT  /tasks/:page/:pos       Modify a task
  PUT  /tasks/:page/:pos/done  Mark task done
  PUT  /tasks/:page/:pos/undo  Unmark task done
  GET  /spaces                 List configured spaces
  GET  /health                 Health check`,

	RunE: func(cmd *cobra.Command, args []string) error {
		cfg, err := loadConfigFile()
		if err != nil {
			return err
		}

		path := cfgFile
		if path == "" {
			path = config.DefaultConfigPath()
		}
		s := serve.NewServer(cfg, path, spaceName, spaceURLFlag, defaultPage, serveHost, servePort)
		if serveWebGUI != "" {
			s.SetWebGUI(serveWebGUI)
		}
		return s.Run()
	},
}

func loadConfigFile() (*config.ConfigFile, error) {
	path := cfgFile
	if path == "" {
		path = config.DefaultConfigPath()
	}
	return config.LoadConfig(path)
}

func init() {
	serveCmd.Flags().StringVar(&serveHost, "host", "localhost", "Host to bind to")
	serveCmd.Flags().IntVar(&servePort, "port", 9876, "Port to listen on")
	serveCmd.Flags().StringVar(&serveWebGUI, "web-gui", "", "Path to frontend dist directory to serve as web GUI")
	rootCmd.AddCommand(serveCmd)
}
