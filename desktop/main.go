package main

import (
	"context"
	"embed"
	"log"
	"time"

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

func (a *App) AddSpace(name, url, defaultPage, inboxPage string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.AddSpace(name, url, defaultPage, inboxPage)
		if err == nil {
			a.RestartSbtask()
		}
		return spaces, err
	}
	return nil, nil
}

func (a *App) UpdateSpace(name, newName, url, defaultPage, inboxPage string) ([]SpaceInfo, error) {
	if a.config != nil {
		spaces, err := a.config.UpdateSpace(name, newName, url, defaultPage, inboxPage)
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

func (a *App) GetConfigPath() string {
	return a.config.configPath()
}

