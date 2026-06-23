package main

import (
	"context"
	"embed"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/justin/sbtask/pkg/client"
	"github.com/justin/sbtask/pkg/config"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	app := &App{}

	err := wails.Run(&options.App{
		Title:     "Silvermind",
		Width:     1200,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}

type App struct {
	ctx    context.Context
	server *SbtaskServer
	config *ConfigManager
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.config = NewConfigManager()
	a.startSbtask()
}

func (a *App) shutdown(ctx context.Context) {
	if a.server != nil {
		a.server.Stop()
	}
}

func (a *App) startSbtask() {
	s, err := StartSbtaskServer(a.config.configPath())
	if err != nil {
		log.Printf("[silvermind] sbtask startup failed: %v", err)
	}
	a.server = s
}

// AppService methods (exposed to frontend)
func (a *App) GetHealth() ServiceHealth {
	if a.server != nil {
		return a.server.GetHealth()
	}
	return ServiceHealth{State: "stopped"}
}

func (a *App) RestartSbtask() {
	if a.server != nil {
		a.server.Stop()
	}
	time.Sleep(200 * time.Millisecond)
	a.startSbtask()
}

func (a *App) ListSpaces() []SpaceInfo {
	if a.config != nil {
		return a.config.ListSpaces()
	}
	return nil
}

func (a *App) AddSpace(name, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.AddSpace(name, url, defaultPage, inboxPage, authToken)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) UpdateSpace(name, newName, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.UpdateSpace(name, newName, url, defaultPage, inboxPage, authToken)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) RemoveSpace(name string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.RemoveSpace(name)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) SetActiveSpace(name string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.SetActiveSpace(name)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) SetSharedConfig(sbtaskPath string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.SetSharedConfig(sbtaskPath)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) MigrateSbtaskConfig() ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.MigrateSbtaskConfig()
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

type verifyResult struct {
	OK        bool   `json:"ok"`
	TaskCount int    `json:"task_count"`
	Error     string `json:"error,omitempty"`
}

func (a *App) VerifySpace(url, authToken string) verifyResult {
	c, err := client.NewClient(client.Config{SpaceURL: url, AuthToken: authToken})
	if err != nil {
		return verifyResult{OK: false, Error: err.Error()}
	}
	tasks, apiErr := c.QueryTasks(map[string]string{"limit": "1"})
	if apiErr != nil {
		return verifyResult{OK: false, Error: apiErr.Error()}
	}
	return verifyResult{OK: true, TaskCount: len(tasks)}
}

type configStatusResult struct {
	Exists       bool        `json:"exists"`
	SbtaskExists bool        `json:"sbtask_exists"`
	SpaceCount   int         `json:"space_count"`
	Spaces       []SpaceInfo `json:"spaces"`
}

func (a *App) GetConfigStatus() configStatusResult {
	if a.config == nil {
		return configStatusResult{}
	}
	result := configStatusResult{Exists: true}
	spaces := a.config.ListSpaces()
	result.SpaceCount = len(spaces)
	result.Spaces = spaces

	sbtaskPath := config.DefaultConfigPath()
	if _, err := os.Stat(sbtaskPath); err == nil && sbtaskPath != a.config.configPath() {
		sbtaskCfg, err := config.LoadConfig(sbtaskPath)
		if err == nil && sbtaskCfg != nil && len(sbtaskCfg.Spaces) > 0 {
			result.SbtaskExists = true
			if !result.Exists || result.SpaceCount == 0 {
				result.Spaces = a.config.GetSbtaskSpaces()
				result.SpaceCount = len(result.Spaces)
			}
		}
	}
	return result
}

func (a *App) GetConfigPath() string {
	return a.config.configPath()
}

func (a *App) OpenURL(url string) {
	if err := exec.Command("xdg-open", url).Start(); err != nil {
		log.Printf("[silvermind] OpenURL failed: %v", err)
	}
}

