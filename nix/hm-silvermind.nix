{ config, lib, pkgs, ... }:

let
  cfg = config.services.silvermind-webui;
  inherit (lib) mkIf mkEnableOption mkOption types;
in {
  options.services.silvermind-webui = {
    enable = mkEnableOption "Silvermind web UI — sbtask API server with Svelte SPA frontend";

    package = mkOption {
      type = types.package;
      default = pkgs.sbtask;
      defaultText = lib.literalMD "`pkgs.sbtask` (from the Silvermind flake)";
      description = "The sbtask binary package providing the `serve` subcommand.";
    };

    frontendDist = mkOption {
      type = types.path;
      description = ''
        Path to the built frontend dist directory.

        Build it with:  pnpm build:web
        Then point this option to:  ./frontend/dist
      '';
      example = "/home/user/projects/silvermind/frontend/dist";
    };

    host = mkOption {
      type = types.str;
      default = "localhost";
      description = "Host address to bind the server to.";
    };

    port = mkOption {
      type = types.port;
      default = 9876;
      description = "TCP port to listen on.";
    };

    extraArgs = mkOption {
      type = types.str;
      default = "";
      description = "Extra command-line arguments forwarded to `sbtask serve`.";
    };
  };

  config = mkIf cfg.enable {
    home.packages = [ cfg.package ];

    systemd.user.services.silvermind-webui = {
      Unit = {
        Description = "Silvermind Web UI — sbtask API server with web GUI";
        Documentation = "https://github.com/justin/silvermind";
        After = [ "network.target" ];
      };

      Service = {
        ExecStart = ''
          ${cfg.package}/bin/sbtask serve \
            --host ${cfg.host} \
            --port ${toString cfg.port} \
            --web-gui ${cfg.frontendDist} \
            ${cfg.extraArgs}
        '';
        Restart = "on-failure";
        RestartSec = "5s";
        Environment = "PATH=${lib.makeBinPath [ pkgs.git ]}";
      };

      Install = {
        WantedBy = [ "default.target" ];
      };
    };
  };
}
