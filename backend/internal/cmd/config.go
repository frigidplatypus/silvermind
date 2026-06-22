package cmd

import (
	"fmt"
	"sort"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/config"
)

var (
	configShowPath bool
	configSetSpace string
	configAddSpace string
	configAddURL   string
	configAddPage  string
	configRmSpace  string
)

var configAddSpaceCmd = &cobra.Command{
	Use:   "add-space <name> <url>",
	Short: "Add a named space",
	Args:  cobra.ExactArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := cfgFile
		if path == "" {
			path = config.DefaultConfigPath()
		}

		cfg, err := config.LoadConfig(path)
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		name := args[0]
		url := args[1]

		cfg.Spaces[name] = config.SpaceConfig{
			Space:       url,
			DefaultPage: configAddPage,
		}
		if cfg.ActiveSpace == "" {
			cfg.ActiveSpace = name
		}
		if err := config.SaveConfig(path, cfg); err != nil {
			return fmt.Errorf("save config: %w", err)
		}
		fmt.Printf("Added space %q (%s) and saved to %s\n", name, url, path)
		return nil
	},
}

var configRemoveSpaceCmd = &cobra.Command{
	Use:   "remove-space <name>",
	Short: "Remove a named space",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := cfgFile
		if path == "" {
			path = config.DefaultConfigPath()
		}

		cfg, err := config.LoadConfig(path)
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		name := args[0]
		if _, ok := cfg.Spaces[name]; !ok {
			return fmt.Errorf("space %q not found", name)
		}
		delete(cfg.Spaces, name)
		if cfg.ActiveSpace == name {
			cfg.ActiveSpace = ""
			for n := range cfg.Spaces {
				cfg.ActiveSpace = n
				break
			}
		}
		if err := config.SaveConfig(path, cfg); err != nil {
			return fmt.Errorf("save config: %w", err)
		}
		fmt.Printf("Removed space %q and saved to %s\n", name, path)
		return nil
	},
}

var configSetSpaceCmd = &cobra.Command{
	Use:   "set-space <name>",
	Short: "Set the active space",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := cfgFile
		if path == "" {
			path = config.DefaultConfigPath()
		}

		cfg, err := config.LoadConfig(path)
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		name := args[0]
		if _, ok := cfg.Spaces[name]; !ok {
			return fmt.Errorf("space %q not found in config", name)
		}
		cfg.ActiveSpace = name
		if err := config.SaveConfig(path, cfg); err != nil {
			return fmt.Errorf("save config: %w", err)
		}
		fmt.Printf("Active space set to %q\n", name)
		return nil
	},
}

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "View or manage configuration",
	Long: `View current configuration or manage named spaces.

Subcommands:
  add-space <name> <url>   Add a named space
  remove-space <name>      Remove a named space
  set-space <name>         Set the active space

Configuration is stored in ~/.config/sbtask/config.yaml.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		path := cfgFile
		if path == "" {
			path = config.DefaultConfigPath()
		}

		cfg, err := config.LoadConfig(path)
		if err != nil {
			return fmt.Errorf("load config: %w", err)
		}

		if configShowPath {
			fmt.Println(path)
			return nil
		}

		activeName := cfg.ActiveSpace
		if activeName == "" {
			for name := range cfg.Spaces {
				activeName = name
				break
			}
		}

		fmt.Printf("Config file:   %s\n", path)
		fmt.Printf("Active space:  %s\n", activeName)
		fmt.Println()

		names := make([]string, 0, len(cfg.Spaces))
		for name := range cfg.Spaces {
			names = append(names, name)
		}
		sort.Strings(names)

		for _, name := range names {
			sc := cfg.Spaces[name]
			marker := " "
			if name == activeName {
				marker = "*"
			}
			fmt.Printf(" %s %-15s  %s\n", marker, name, sc.Space)
		}

		return nil
	},
}

func init() {
	configCmd.Flags().BoolVar(&configShowPath, "path", false, "Print config file path only")

	configAddSpaceCmd.Flags().StringVar(&configAddPage, "default-page", "Tasks", "Default page for the space")
	configCmd.AddCommand(configAddSpaceCmd)
	configCmd.AddCommand(configRemoveSpaceCmd)
	configCmd.AddCommand(configSetSpaceCmd)

	rootCmd.AddCommand(configCmd)
}
