package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"gopkg.in/yaml.v3"
)

type SpaceConfig struct {
	Space       string `yaml:"space,omitempty" json:"space"`
	AuthToken   string `yaml:"auth_token,omitempty" json:"auth_token,omitempty"`
	DefaultPage string `yaml:"default_page,omitempty" json:"default_page,omitempty"`
	InboxPage   string `yaml:"inbox_page,omitempty" json:"inbox_page,omitempty"`
}

type ConfigFile struct {
	Spaces      map[string]SpaceConfig `yaml:"spaces" json:"spaces"`
	ActiveSpace string                 `yaml:"active_space,omitempty" json:"active_space,omitempty"`
}

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
	return &ConfigManager{path: silvermindConfigPath()}
}

func (c *ConfigManager) configPath() string {
	return c.path
}

func (c *ConfigManager) ensureDir() error {
	if c.path == "" {
		return fmt.Errorf("no config path")
	}
	return os.MkdirAll(filepath.Dir(c.path), 0755)
}

func (c *ConfigManager) load() (*ConfigFile, error) {
	data, err := os.ReadFile(c.path)
	if err != nil {
		if os.IsNotExist(err) {
			return &ConfigFile{Spaces: make(map[string]SpaceConfig)}, nil
		}
		return nil, fmt.Errorf("read config: %w", err)
	}
	var cfg ConfigFile
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	if cfg.Spaces == nil {
		cfg.Spaces = make(map[string]SpaceConfig)
	}
	return &cfg, nil
}

func (c *ConfigManager) save(cfg *ConfigFile) error {
	if err := c.ensureDir(); err != nil {
		return err
	}
	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshal config: %w", err)
	}
	return os.WriteFile(c.path, data, 0644)
}

func (c *ConfigManager) ReadConfig() string {
	cfg, err := c.load()
	if err != nil {
		log.Printf("[silvermind] ReadConfig error: %v", err)
		return ""
	}
	data, err := yaml.Marshal(map[string]any{
		"spaces":       cfg.Spaces,
		"active_space": cfg.ActiveSpace,
	})
	if err != nil {
		return ""
	}
	return string(data)
}

func (c *ConfigManager) WriteConfig(raw string) error {
	var cfg ConfigFile
	if err := yaml.Unmarshal([]byte(raw), &cfg); err != nil {
		return fmt.Errorf("parse config: %w", err)
	}
	if cfg.Spaces == nil {
		cfg.Spaces = make(map[string]SpaceConfig)
	}
	return c.save(&cfg)
}

func toSpaces(cfg *ConfigFile) []SpaceInfo {
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
		log.Printf("[silvermind] ListSpaces error: %v", err)
		return nil
	}
	return toSpaces(cfg)
}

func (c *ConfigManager) AddSpace(name, url, defaultPage, inboxPage, authToken string) ([]SpaceInfo, error) {
	cfg, err := c.load()
	if err != nil {
		return nil, err
	}
	nameLower := strings.ToLower(name)
	for existingName := range cfg.Spaces {
		if strings.ToLower(existingName) == nameLower {
			return nil, fmt.Errorf("space %q already exists (as %q)", name, existingName)
		}
	}
	if defaultPage == "" {
		defaultPage = "Tasks"
	}
	if inboxPage == "" {
		inboxPage = "Inbox"
	}
	cfg.Spaces[name] = SpaceConfig{
		Space:       url,
		AuthToken:   authToken,
		DefaultPage: defaultPage,
		InboxPage:   inboxPage,
	}
	if cfg.ActiveSpace == "" {
		cfg.ActiveSpace = name
	}
	if err := c.save(cfg); err != nil {
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
	if authToken != "" {
		sp.AuthToken = authToken
	}
	if newName == "" {
		newName = name
	}
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
