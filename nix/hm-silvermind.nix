{ config, lib, pkgs, ... }:

let
  cfg = config.services.silvermind-webui;
  inherit (lib) mkIf mkEnableOption mkOption types;
in {
  options.services.silvermind-webui = {
    enable = mkEnableOption "Silvermind web UI — static Svelte SPA served via Node.js";

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
  };

  config = mkIf cfg.enable {
    home.packages = [ pkgs.nodejs-slim_22 ];

    systemd.user.services.silvermind-webui = {
      Unit = {
        Description = "Silvermind Web UI — Svelte SPA static server";
        Documentation = "https://github.com/justin/silvermind";
        After = [ "network.target" ];
      };

      Service = {
        ExecStart = ''
          ${pkgs.nodejs-slim_22}/bin/node -e "
            const http = require('http');
            const fs = require('fs');
            const path = require('path');
            const dist = '${cfg.frontendDist}';
            const mime = {
              '.html': 'text/html', '.js': 'application/javascript',
              '.css': 'text/css', '.svg': 'image/svg+xml',
              '.png': 'image/png', '.ico': 'image/x-icon',
            };
            http.createServer((req, res) => {
              let filePath = path.join(dist, req.url === '/' ? 'index.html' : req.url);
              const ext = path.extname(filePath);
              try {
                const content = fs.readFileSync(filePath);
                res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
                res.end(content);
              } catch {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(fs.readFileSync(path.join(dist, 'index.html')));
              }
            }).listen(${toString cfg.port}, '${cfg.host}');
          "
        '';
        Restart = "on-failure";
        RestartSec = "5s";
      };

      Install = {
        WantedBy = [ "default.target" ];
      };
    };
  };
}
