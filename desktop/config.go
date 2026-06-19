package main

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type SpaceConfig struct {
	Name        string `json:"name"`
	URL         string `json:"url"`
	DefaultPage string `json:"default_page"`
	InboxPage   string `json:"inbox_page"`
	Active      bool   `json:"active"`
}

type configFile struct {
	Spaces      map[string]struct {
		Space       string `yaml:"space"`
		DefaultPage string `yaml:"default_page"`
		InboxPage   string `yaml:"inbox_page"`
	} `yaml:"spaces"`
	ActiveSpace string `yaml:"active_space"`
}

type ConfigManager struct {
	path string
}

func NewConfigManager() *ConfigManager {
	home, _ := os.UserHomeDir()
	return &ConfigManager{
		path: filepath.Join(home, ".config", "sbtask", "config.yaml"),
	}
}

func (c *ConfigManager) configPath() string {
	return c.path
}

func (c *ConfigManager) load() (*configFile, error) {
	data, err := os.ReadFile(c.configPath())
	if err != nil {
		return nil, err
	}
	var cfg configFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}
	if cfg.Spaces == nil {
		cfg.Spaces = make(map[string]struct {
			Space       string `yaml:"space"`
			DefaultPage string `yaml:"default_page"`
			InboxPage   string `yaml:"inbox_page"`
		})
	}
	return &cfg, nil
}

func (c *ConfigManager) save(cfg *configFile) error {
	dir := filepath.Dir(c.configPath())
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return err
	}
	return os.WriteFile(c.configPath(), data, 0644)
}

func (c *ConfigManager) ListSpaces() []SpaceConfig {
	cfg, err := c.load()
	if err != nil {
		return nil
	}
	return mapSpaces(cfg)
}

func mapSpaces(cfg *configFile) []SpaceConfig {
	var spaces []SpaceConfig
	for name, sp := range cfg.Spaces {
		spaces = append(spaces, SpaceConfig{
			Name:        name,
			URL:         sp.Space,
			DefaultPage: sp.DefaultPage,
			InboxPage:   sp.InboxPage,
			Active:      name == cfg.ActiveSpace,
		})
	}
	return spaces
}

func (c *ConfigManager) AddSpace(name, url, defaultPage, inboxPage string) ([]SpaceConfig, error) {
	cfg, err := c.load()
	if err != nil {
		// Create default config if missing
		cfg = &configFile{ActiveSpace: name}
	}
	if cfg.Spaces == nil {
		cfg.Spaces = make(map[string]struct {
			Space       string `yaml:"space"`
			DefaultPage string `yaml:"default_page"`
			InboxPage   string `yaml:"inbox_page"`
		})
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
	cfg.Spaces[name] = struct {
		Space       string `yaml:"space"`
		DefaultPage string `yaml:"default_page"`
		InboxPage   string `yaml:"inbox_page"`
	}{Space: url, DefaultPage: defaultPage, InboxPage: inboxPage}
	if cfg.ActiveSpace == "" {
		cfg.ActiveSpace = name
	}
	if err := c.save(cfg); err != nil {
		return nil, err
	}
	return mapSpaces(cfg), nil
}

func (c *ConfigManager) UpdateSpace(name, url, defaultPage, inboxPage string) ([]SpaceConfig, error) {
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
	return mapSpaces(cfg), nil
}

func (c *ConfigManager) RemoveSpace(name string) ([]SpaceConfig, error) {
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
	return mapSpaces(cfg), nil
}

func (c *ConfigManager) SetActiveSpace(name string) ([]SpaceConfig, error) {
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
	return mapSpaces(cfg), nil
}
