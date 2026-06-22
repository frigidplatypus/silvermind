{ pkgs, lib, config, inputs, ... }:
{
  # https://devenv.sh/basics/
  env.GREET = "devenv";

  # https://devenv.sh/packages/
  packages = with pkgs; [
    git
    go
    gopls
    delve
    just
    nodejs-slim_22
    pnpm
    wails
    webkitgtk_4_1
    gtk3
    pkg-config
    # sbtask is local at ./backend — build with 'go build ./cmd/sbtask' from backend/
  ];

  # https://devenv.sh/languages/
  languages.javascript = {
    enable = true;
    npm.enable = false;
    pnpm.enable = true;
  };

  languages.go = {
    enable = true;
  };

  # https://devenv.sh/processes/
  processes.sbtask.exec = "cd ${config.env.DEVENV_ROOT}/backend && go run ./cmd/sbtask --config ${config.env.DEVENV_ROOT}/sbtask-config.yaml serve --port 7433 --host 0.0.0.0";
  processes.vite.exec = "${lib.getExe pkgs.pnpm} --dir ${config.env.DEVENV_ROOT} exec vite --host 0.0.0.0 --port 5173";

  # https://devenv.sh/scripts/
  scripts.hello.exec = ''
    echo hello from $GREET
  '';

  scripts.build-desktop.exec = ''
    echo "Building Silvermind desktop..."
    nix build ${config.env.DEVENV_ROOT}#silvermind-desktop --no-link
    echo "Done: result/bin/silvermind-desktop"
  '';

  # https://devenv.sh/basics/
  enterShell = ''
    hello
    git --version
    go version
    echo "Silvermind packages:"
    echo "  sbtask:               cd backend && go run ./cmd/sbtask"
    echo "  silvermind-desktop:   built by 'nix build .#silvermind-desktop'"
    echo "  web-gui:              just serve-web"
    echo ""
    echo "Run 'devenv up' to start sbtask + vite"
  '';

  # https://devenv.sh/tests/
  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';

  # See full reference at https://devenv.sh/reference/options/
}
