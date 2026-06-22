package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"github.com/justin/sbtask/pkg/client"
	"github.com/justin/sbtask/pkg/config"
)

var (
	cfgFile      string
	spaceName    string
	spaceURLFlag string
	defaultPage  string
	jsonOutput   bool
)

var rootCmd = &cobra.Command{
	Use:   "sbtask",
	Short: "SilverBullet task management CLI",
	Long: `sbtask is a CLI tool and library for managing tasks in SilverBullet.md spaces.

Query, create, and modify tasks across your entire SilverBullet space.
Requires SilverBullet running the runtime-api Docker variant.`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "sbtask: %s\n", err)
		os.Exit(1)
	}
}

func init() {
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default ~/.config/sbtask/config.yaml)")
	rootCmd.PersistentFlags().StringVarP(&spaceName, "space", "s", "", "Named space from config (default: active space)")
	rootCmd.PersistentFlags().StringVar(&spaceURLFlag, "space-url", "", "SilverBullet space URL (ad-hoc, bypasses config)")
	rootCmd.PersistentFlags().StringVar(&defaultPage, "default-page", "", "Default page for new tasks")
	rootCmd.PersistentFlags().BoolVar(&jsonOutput, "json", false, "Output results as JSON")
}

func loadClient() (*client.Client, *config.ConfigFile, config.SpaceConfig, error) {
	path := cfgFile
	if path == "" {
		path = config.DefaultConfigPath()
	}

	cfg, err := config.LoadConfig(path)
	if err != nil {
		return nil, nil, config.SpaceConfig{}, fmt.Errorf("failed to load config: %w", err)
	}

	if cfg.ActiveSpace != "" {
		config.MergeEnv(cfg, cfg.ActiveSpace)
	}

	sc, err := config.ResolveSpace(cfg, spaceName, spaceURLFlag)
	if err != nil {
		return nil, nil, config.SpaceConfig{}, err
	}

	if defaultPage != "" {
		sc.DefaultPage = defaultPage
	}

	c, err := client.NewClient(client.Config{
		SpaceURL:  sc.Space,
		AuthToken: sc.AuthToken,
	})
	if err != nil {
		return nil, nil, config.SpaceConfig{}, err
	}

	return c, cfg, sc, nil
}
