// Package config manages sbtask configuration.
//
// Configuration is loaded from a YAML config file (~/.config/sbtask/config.yaml)
// supporting named spaces with environment variable overrides (SBTASK_SPACE,
// SBTASK_DEFAULT_PAGE) and CLI flag overrides as the highest precedence.
//
// Single-space backward compat: old flat config is auto-migrated to a "main"
// named space on first load.
//
// Usage:
//
//	cfg, _ := config.LoadConfig(config.DefaultConfigPath())
//	sc, _ := config.ResolveSpace(cfg, "main", "")
//	c, _ := client.NewClient(client.Config{SpaceURL: sc.Space})
package config
