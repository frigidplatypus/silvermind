package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"gopkg.in/yaml.v3"
)

type SpaceConfig struct {
	Space       string   `yaml:"space"`
	AuthToken   string   `yaml:"auth_token,omitempty"`
	DefaultPage string   `yaml:"default_page"`
	InboxPage   string   `yaml:"inbox_page"`
	ExcludeTags []string `yaml:"exclude_tags,omitempty"`
}

type ConfigFile struct {
	SharedConfig bool                   `yaml:"shared_config,omitempty"`
	SbtaskPath   string                 `yaml:"sbtask_path,omitempty"`
	Space        string                 `yaml:"space,omitempty"`
	DefaultPage  string                 `yaml:"default_page,omitempty"`
	InboxPage    string                 `yaml:"inbox_page,omitempty"`
	ExcludeTags  []string               `yaml:"exclude_tags,omitempty"`
	Spaces       map[string]SpaceConfig `yaml:"spaces,omitempty"`
	ActiveSpace  string                 `yaml:"active_space,omitempty"`
}

func DefaultConfig() *ConfigFile {
	return &ConfigFile{
		Spaces: map[string]SpaceConfig{
			"main": {
				Space:       "http://localhost:3000",
				DefaultPage: "Tasks",
				InboxPage:   "Inbox",
			},
		},
		ActiveSpace: "main",
	}
}

func DefaultConfigPath() string {
	dir := os.Getenv("XDG_CONFIG_HOME")
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return ""
		}
		dir = filepath.Join(home, ".config")
	}
	return filepath.Join(dir, "sbtask", "config.yaml")
}

func LoadConfig(path string) (*ConfigFile, error) {
	if path == "" {
		return DefaultConfig(), nil
	}
	cfg := DefaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, fmt.Errorf("failed to read config file %s: %w", path, err)
	}

	var raw ConfigFile
	if err := yaml.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse config file %s: %w", path, err)
	}

	if raw.Space != "" {
		cfg.Spaces["main"] = SpaceConfig{
			Space:       raw.Space,
			DefaultPage: firstNonEmpty(raw.DefaultPage, "Tasks"),
			InboxPage:   firstNonEmpty(raw.InboxPage, "Inbox"),
		}
		cfg.ActiveSpace = "main"
		return cfg, nil
	}

	if len(raw.Spaces) > 0 {
		cfg.Spaces = raw.Spaces
	}

	if raw.ActiveSpace != "" {
		cfg.ActiveSpace = raw.ActiveSpace
	} else if len(cfg.Spaces) == 1 {
		for name := range cfg.Spaces {
			cfg.ActiveSpace = name
			break
		}
	}

	return cfg, nil
}

func GetSpace(cfg *ConfigFile, name string) (SpaceConfig, error) {
	if name == "" {
		sc, err := ActiveSpaceConfig(cfg)
		if err != nil {
			return SpaceConfig{}, err
		}
		return sc, nil
	}

	sc, ok := cfg.Spaces[name]
	if !ok {
		return SpaceConfig{}, fmt.Errorf("space %q not found in config", name)
	}
	return sc, nil
}

func ActiveSpaceConfig(cfg *ConfigFile) (SpaceConfig, error) {
	if cfg.ActiveSpace == "" {
		names := sortedSpaceNames(cfg)
		if len(names) > 0 {
			cfg.ActiveSpace = names[0]
		}
	}

	if cfg.ActiveSpace == "" {
		return SpaceConfig{}, fmt.Errorf("no spaces configured")
	}

	sc, ok := cfg.Spaces[cfg.ActiveSpace]
	if !ok {
		return SpaceConfig{}, fmt.Errorf("active space %q not found in config", cfg.ActiveSpace)
	}
	return sc, nil
}

func MergeEnv(cfg *ConfigFile, targetName string) {
	sc, ok := cfg.Spaces[targetName]
	if !ok {
		sc = SpaceConfig{DefaultPage: "Tasks", InboxPage: "Inbox"}
	}
	if v := os.Getenv("SBTASK_SPACE"); v != "" {
		sc.Space = v
	}
	if v := os.Getenv("SBTASK_AUTH_TOKEN"); v != "" {
		sc.AuthToken = v
	}
	if v := os.Getenv("SBTASK_DEFAULT_PAGE"); v != "" {
		sc.DefaultPage = v
	}
	cfg.Spaces[targetName] = sc
}

func ResolveSpace(cfg *ConfigFile, spaceName string, spaceURL string) (SpaceConfig, error) {
	if spaceURL != "" {
		name := spaceName
		if name == "" {
			name = "ad-hoc"
		}
		sc := SpaceConfig{
			Space:       spaceURL,
			DefaultPage: "Tasks",
			InboxPage:   "Inbox",
		}
		// Preserve auth token from config when both name and URL are given
		if name != "" {
			if stored, ok := cfg.Spaces[name]; ok && stored.AuthToken != "" {
				sc.AuthToken = stored.AuthToken
			}
		}
		if v := os.Getenv("SBTASK_AUTH_TOKEN"); v != "" {
			sc.AuthToken = v
		}
		return sc, nil
	}

	return GetSpace(cfg, spaceName)
}

func SaveConfig(path string, cfg *ConfigFile) error {
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory %s: %w", dir, err)
	}

	raw := ConfigFile{
		Spaces:      cfg.Spaces,
		ActiveSpace: cfg.ActiveSpace,
	}

	data, err := yaml.Marshal(&raw)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file %s: %w", path, err)
	}

	return nil
}

func sortedSpaceNames(cfg *ConfigFile) []string {
	names := make([]string, 0, len(cfg.Spaces))
	for name := range cfg.Spaces {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
