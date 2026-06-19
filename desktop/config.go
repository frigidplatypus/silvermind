package main

import (
	"fmt"
	"sort"

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

func NewConfigManager() *ConfigManager {
	return &ConfigManager{
		path: config.DefaultConfigPath(),
	}
}

func (c *ConfigManager) configPath() string {
	return c.path
}

func (c *ConfigManager) load() (*config.ConfigFile, error) {
	return config.LoadConfig(c.path)
}

func (c *ConfigManager) save(cfg *config.ConfigFile) error {
	return config.SaveConfig(c.path, cfg)
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

func (c *ConfigManager) AddSpace(name, url, defaultPage, inboxPage string) ([]SpaceInfo, error) {
	cfg, err := c.load()
	if err != nil {
		return nil, err
	}
	if _, exists := cfg.Spaces[name]; exists {
		return nil, fmt.Errorf("space %q already exists", name)
	}
	if defaultPage == "" {
		defaultPage = "Tasks"
	}
	if inboxPage == "" {
		inboxPage = "Inbox"
	}
	cfg.Spaces[name] = config.SpaceConfig{
		Space:       url,
		DefaultPage: defaultPage,
		InboxPage:   inboxPage,
	}
	if cfg.ActiveSpace == "" {
		cfg.ActiveSpace = name
	}
	if err := c.save(cfg); err != nil {
		return nil, err
	}
	return toSpaces(cfg), nil
}

func (c *ConfigManager) UpdateSpace(name, url, defaultPage, inboxPage string) ([]SpaceInfo, error) {
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
	cfg.Spaces[name] = sp
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
