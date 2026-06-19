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
    nodejs-slim_22
    pnpm
    wails
    webkitgtk_6_0
    gtk3
    pkg-config

    # sbtask CLI from sbtask flake
    inputs.sbtask.packages.${pkgs.system}.sbtask
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
  processes.sbtask.exec = "sbtask --config ${config.env.DEVENV_ROOT}/sbtask-config.yaml serve --port 7433 --host 0.0.0.0";
  processes.vite.exec = "${lib.getExe pkgs.pnpm} --dir ${config.env.DEVENV_ROOT} exec vite --host 0.0.0.0 --port 5173";

  # https://devenv.sh/scripts/
  scripts.hello.exec = ''
    echo hello from $GREET
  '';

  scripts.build-desktop.exec = ''
    echo "Building Silvermind desktop..."
    nix build ${config.env.DEVENV_ROOT}#silvermind --no-link
    echo "Done: result/bin/silvermind"
  '';

  # https://devenv.sh/basics/
  enterShell = ''
    hello
    git --version
    go version
    echo "Silvermind packages:"
    echo "  sbtask:          $(which sbtask)"
    echo "  silvermind:   $(which silvermind || echo 'built by flake, not in PATH by default')"
    echo ""
    echo "Run 'devenv up' to start sbtask + vite + desktop"
  '';

  # https://devenv.sh/tests/
  enterTest = ''
    echo "Running tests"
    git --version | grep --color=auto "${pkgs.git.version}"
  '';

  # See full reference at https://devenv.sh/reference/options/
}
