{ pkgs, lib, config, inputs, ... }:
{
  env.GREET = "devenv";

  packages = with pkgs; [
    git
    just
    nodejs-slim_22
    pnpm
    wails
    webkitgtk_4_1
    gtk3
    pkg-config
  ];

  languages.javascript = {
    enable = true;
    npm.enable = false;
    pnpm.enable = true;
  };

  processes.vite.exec = "${lib.getExe pkgs.pnpm} --dir ${config.env.DEVENV_ROOT} exec vite --host 0.0.0.0 --port 5173";

  scripts.build-desktop.exec = ''
    echo "Building Silvermind desktop..."
    nix build ${config.env.DEVENV_ROOT}#silvermind-desktop --no-link
    echo "Done: result/bin/silvermind-desktop"
  '';

  enterShell = ''
    echo "Silvermind — JS-native backend"
    echo ""
    echo "  pnpm dev              Start Vite dev server (browser)"
    echo "  pnpm build:desktop    Build frontend assets"
    echo "  nix build             Build desktop app"
    echo ""
    echo "Run 'devenv up' to start Vite dev server"
  '';

  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';
}
