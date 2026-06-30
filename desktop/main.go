package main

import (
	"context"
	"embed"
	"log"
	"os"
	"os/exec"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/linux"
)

var sentryDsn = ""

//go:embed frontend/dist
var assets embed.FS

//go:embed appicon.png
var appIcon []byte

func initDesktopSentry() {
	if sentryDsn == "" {
		log.Println("[silvermind] sentry disabled — set SILVERMIND_SENTRY_DSN env during build")
		return
	}
	err := sentry.Init(sentry.ClientOptions{
		Dsn:              sentryDsn,
		Release:          "silvermind-desktop@0.1.0",
		Environment:      "production",
		AttachStacktrace: true,
	})
	if err != nil {
		log.Printf("[silvermind] sentry init failed: %v", err)
		return
	}
	sentry.ConfigureScope(func(scope *sentry.Scope) {
		scope.SetTag("platform", "desktop")
		scope.SetTag("os", runtimeOS())
	})
	log.Println("[silvermind] sentry enabled")
}

func runtimeOS() string {
	if _, err := os.Stat("/etc/NIXOS"); err == nil {
		return "nixos"
	}
	return "linux"
}

func main() {
	initDesktopSentry()
	defer sentry.Flush(2 * time.Second)
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
		Linux: &linux.Options{
			Icon:        appIcon,
			ProgramName: "Silvermind Desktop",
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
	config *ConfigManager
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.config = NewConfigManager()
	log.Println("[silvermind] desktop started (JS-native backend)")
}

func (a *App) shutdown(ctx context.Context) {
	log.Println("[silvermind] desktop shutting down")
}

func (a *App) ListSpaces() []SpaceInfo {
	if a.config != nil {
		return a.config.ListSpaces()
	}
	return nil
}

func (a *App) AddSpace(name, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	if a.config == nil {
		return nil, nil
	}
	return a.config.AddSpace(name, url, defaultPage, inboxPage, authToken)
}

func (a *App) UpdateSpace(name, newName, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	if a.config == nil {
		return nil, nil
	}
	return a.config.UpdateSpace(name, newName, url, defaultPage, inboxPage, authToken)
}

func (a *App) RemoveSpace(name string) ([]SpaceInfo, error) {
	if a.config == nil {
		return nil, nil
	}
	return a.config.RemoveSpace(name)
}

func (a *App) SetActiveSpace(name string) ([]SpaceInfo, error) {
	if a.config == nil {
		return nil, nil
	}
	return a.config.SetActiveSpace(name)
}

func (a *App) ReadConfig() string {
	if a.config == nil {
		return ""
	}
	return a.config.ReadConfig()
}

func (a *App) WriteConfig(raw string) error {
	if a.config == nil {
		return nil
	}
	return a.config.WriteConfig(raw)
}

func (a *App) GetConfigPath() string {
	if a.config != nil {
		return a.config.configPath()
	}
	return ""
}

func (a *App) GetConfigStatus() map[string]any {
	if a.config == nil {
		return map[string]any{
			"exists":        false,
			"sbtask_exists": false,
			"space_count":   0,
			"spaces":        []SpaceInfo{},
		}
	}
	spaces := a.config.ListSpaces()
	return map[string]any{
		"exists":        len(spaces) > 0,
		"sbtask_exists": false,
		"space_count":   len(spaces),
		"spaces":        spaces,
	}
}

func (a *App) OpenURL(url string) {
	if err := exec.Command("xdg-open", url).Start(); err != nil {
		log.Printf("[silvermind] OpenURL failed: %v", err)
	}
}

func (a *App) NotifyAlert(title, body string) {
	if err := exec.Command("notify-send", title, body, "--app-name=Silvermind", "--icon=dialog-information").Start(); err != nil {
		log.Printf("[silvermind] NotifyAlert failed: %v", err)
	}
}
