package main

import (
	"context"
	"embed"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed frontend/dist
var assets embed.FS

func main() {
	app := &App{}

	err := wails.Run(&options.App{
		Title:     "Prowl",
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
	a.config = &ConfigManager{}
	a.startSbtask()
}

func (a *App) shutdown(ctx context.Context) {
	if a.server != nil {
		a.server.Stop()
	}
}

func (a *App) startSbtask() {
	home, _ := os.UserHomeDir()
	cfgPath := filepath.Join(home, ".config", "sbtask", "config.yaml")
	s, err := StartSbtaskServer(cfgPath)
	if err != nil {
		log.Printf("[prowl] sbtask startup failed: %v", err)
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
	a.startSbtask()
}

func (a *App) ListSpaces() []SpaceConfig {
	if a.config != nil {
		return a.config.ListSpaces()
	}
	return nil
}

func (a *App) AddSpace(name, url, defaultPage, inboxPage string) ([]SpaceConfig, error) {
	if a.config != nil {
		return a.config.AddSpace(name, url, defaultPage, inboxPage)
	}
	return nil, nil
}

func (a *App) UpdateSpace(name, url, defaultPage, inboxPage string) ([]SpaceConfig, error) {
	if a.config != nil {
		return a.config.UpdateSpace(name, url, defaultPage, inboxPage)
	}
	return nil, nil
}

func (a *App) RemoveSpace(name string) ([]SpaceConfig, error) {
	if a.config != nil {
		return a.config.RemoveSpace(name)
	}
	return nil, nil
}

func (a *App) SetActiveSpace(name string) ([]SpaceConfig, error) {
	if a.config != nil {
		spaces, err := a.config.SetActiveSpace(name)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) GetConfigPath() string {
	home, _ := os.UserHomeDir()
	return filepath.Join(home, ".config", "sbtask", "config.yaml")
}

