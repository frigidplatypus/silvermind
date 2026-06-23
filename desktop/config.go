package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/justin/sbtask/pkg/config"
)

type SpaceInfo struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	DefaultPage string `json:"default_page"`
	InboxPage   string `json:"inbox_page"`
	Active      bool   `json:"active"`
}

type ConfigManager struct {
	path string
}

func silvermindConfigPath() string {
	dir := os.Getenv("XDG_CONFIG_HOME")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "silvermind", "config.yaml")
}

func NewConfigManager() *ConfigManager {
	cm := &ConfigManager{
		path: silvermindConfigPath(),
	}
	cm.migrate()
	return cm
}

// migrate imports sbtask config on first run if Silvermind config doesn't exist
func (c *ConfigManager) migrate() {
	if c.path == "" {
		return
	}
	// If our config already exists, nothing to migrate
	if _, err := os.Stat(c.path); err == nil {
		return
	}
	// Try to load from sbtask config path
	sbtaskCfg, err := config.LoadConfig(config.DefaultConfigPath())
	if err != nil || sbtaskCfg == nil {
		return
	}
	// Only migrate if it has at least one space and isn't the default
	if len(sbtaskCfg.Spaces) == 0 {
		return
	}
	// Check if it's the bare default (single "main" space at localhost)
	if len(sbtaskCfg.Spaces) == 1 {
		if sp, ok := sbtaskCfg.Spaces["main"]; ok && sp.Space == "http://localhost:3000" {
			return // skip default-only config
		}
	}
	// Save to our path
	if err := os.MkdirAll(filepath.Dir(c.path), 0755); err != nil {
		log.Printf("[silvermind] config dir creation failed: %v", err)
		return
	}
	if err := config.SaveConfig(c.path, sbtaskCfg); err != nil {
		log.Printf("[silvermind] config migration failed: %v", err)
		return
	}
	log.Printf("[silvermind] migrated config from %s", config.DefaultConfigPath())
}

func (c *ConfigManager) configPath() string {
	return c.path
}

func (c *ConfigManager) load() (*config.ConfigFile, error) {
	cfg, err := config.LoadConfig(c.path)
	if err != nil {
		return nil, err
	}
	if cfg != nil && cfg.SharedConfig && cfg.SbtaskPath != "" {
		return config.LoadConfig(cfg.SbtaskPath)
	}
	return cfg, nil
}

func (c *ConfigManager) save(cfg *config.ConfigFile) error {
	targetPath := c.path
	if cfg.SharedConfig && cfg.SbtaskPath != "" {
		targetPath = cfg.SbtaskPath
	} else {
		if err := os.MkdirAll(filepath.Dir(c.path), 0755); err != nil {
			return fmt.Errorf("create config dir: %w", err)
		}
	}
	return config.SaveConfig(targetPath, cfg)
}

func (c *ConfigManager) resolveSavePath(cfg *config.ConfigFile) string {
	if cfg.SharedConfig && cfg.SbtaskPath != "" {
		return cfg.SbtaskPath
	}
	return c.path
}

func (c *ConfigManager) SetSharedConfig(sbtaskPath string) ([]SpaceInfo, error) {
	if sbtaskPath == "" {
		sbtaskPath = config.DefaultConfigPath()
	}
	sbtaskCfg, err := config.LoadConfig(sbtaskPath)
	if err != nil || sbtaskCfg == nil {
		return nil, fmt.Errorf("failed to load sbtask config: %w", err)
	}
	if len(sbtaskCfg.Spaces) == 0 {
		return nil, fmt.Errorf("sbtask config has no spaces")
	}
	sbtaskCfg.SharedConfig = true
	sbtaskCfg.SbtaskPath = sbtaskPath
	if err := c.save(sbtaskCfg); err != nil {
		return nil, err
	}
	log.Printf("[silvermind] using shared config at %s", sbtaskPath)
	return toSpaces(sbtaskCfg), nil
}

func (c *ConfigManager) HasSharedConfig() bool {
	cfg, err := config.LoadConfig(c.path)
	if err != nil || cfg == nil {
		return false
	}
	return cfg.SharedConfig && cfg.SbtaskPath != ""
}

func (c *ConfigManager) MigrateSbtaskConfig() ([]SpaceInfo, error) {
	c.migrate()
	cfg, err := c.load()
	if err != nil || cfg == nil {
		return nil, fmt.Errorf("migration produced no config")
	}
	return toSpaces(cfg), nil
}

func (c *ConfigManager) GetSbtaskSpaces() []SpaceInfo {
	sbtaskCfg, err := config.LoadConfig(config.DefaultConfigPath())
	if err != nil || sbtaskCfg == nil || len(sbtaskCfg.Spaces) == 0 {
		return nil
	}
	return toSpaces(sbtaskCfg)
}

func toSpaces(cfg *config.ConfigFile) []SpaceInfo {
	var spaces []SpaceInfo
	for name, sp := range cfg.Spaces {
		spaces = append(spaces, SpaceInfo{
			Name:        name,
			URL:         sp.Space,
			DefaultPage: sp.DefaultPage,
			InboxPage:   sp.InboxPage,
			Active:      name == cfg.ActiveSpace,
		})
	}
	sort.Slice(spaces, func(i, j int) bool { return spaces[i].Name < spaces[j].Name })
	return spaces
}

func (c *ConfigManager) ListSpaces() []SpaceInfo {
	cfg, err := c.load()
	if err != nil {
		return nil
	}
	return toSpaces(cfg)
}

func (c *ConfigManager) AddSpace(name, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	cfg, err := c.load()
	if err != nil {
		log.Printf("[silvermind] AddSpace load error: %v", err)
		return nil, err
	}
	// Case-insensitive duplicate check
	nameLower := strings.ToLower(name)
	for existingName := range cfg.Spaces {
		if strings.ToLower(existingName) == nameLower {
			err := fmt.Errorf("space %q already exists (as %q)", name, existingName)
			log.Printf("[silvermind] AddSpace: %v", err)
			return nil, err
		}
	}
	if defaultPage == "" {
		defaultPage = "Tasks"
	}
	if inboxPage == "" {
		inboxPage = "Inbox"
	}
	cfg.Spaces[name] = config.SpaceConfig{
		Space:       url,
		AuthToken:   authToken,
		DefaultPage: defaultPage,
		InboxPage:   inboxPage,
	}
	if cfg.ActiveSpace == "" {
		cfg.ActiveSpace = name
	}
	if err := c.save(cfg); err != nil {
		log.Printf("[silvermind] AddSpace save error: %v", err)
		return nil, err
	}
	log.Printf("[silvermind] Added space %q -> %s", name, url)
	return toSpaces(cfg), nil
}

func (c *ConfigManager) UpdateSpace(name, newName, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	cfg, err := c.load()
	if err != nil {
		return nil, err
	}
	sp, exists := cfg.Spaces[name]
	if !exists {
		return nil, fmt.Errorf("space %q not found", name)
	}
	if url != "" {
		sp.Space = url
	}
	if defaultPage != "" {
		sp.DefaultPage = defaultPage
	}
	if inboxPage != "" {
		sp.InboxPage = inboxPage
	}
	// authToken is always set on update (empty string clears it)
	sp.AuthToken = authToken
	if newName == "" {
		newName = name
	}
	// Check for rename collision (case-insensitive)
	if strings.ToLower(newName) != strings.ToLower(name) {
		for existingName := range cfg.Spaces {
			if strings.ToLower(existingName) == strings.ToLower(newName) {
				return nil, fmt.Errorf("space %q already exists", newName)
			}
		}
	}
	delete(cfg.Spaces, name)
	cfg.Spaces[newName] = sp
	if cfg.ActiveSpace == name {
		cfg.ActiveSpace = newName
	}
	if err := c.save(cfg); err != nil {
		return nil, err
	}
	return toSpaces(cfg), nil
}

func (c *ConfigManager) RemoveSpace(name string) ([]SpaceInfo, error) {
	cfg, err := c.load()
	if err != nil {
		return nil, err
	}
	if _, exists := cfg.Spaces[name]; !exists {
		return nil, fmt.Errorf("space %q not found", name)
	}
	delete(cfg.Spaces, name)
	if cfg.ActiveSpace == name {
		cfg.ActiveSpace = ""
		for n := range cfg.Spaces {
			cfg.ActiveSpace = n
			break
		}
	}
	if err := c.save(cfg); err != nil {
		return nil, err
	}
	return toSpaces(cfg), nil
}

func (c *ConfigManager) SetActiveSpace(name string) ([]SpaceInfo, error) {
	cfg, err := c.load()
	if err != nil {
		return nil, err
	}
	if _, exists := cfg.Spaces[name]; !exists {
		return nil, fmt.Errorf("space %q not found", name)
	}
	cfg.ActiveSpace = name
	if err := c.save(cfg); err != nil {
		return nil, err
	}
	return toSpaces(cfg), nil
}
