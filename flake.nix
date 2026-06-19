{
  description = "Prowl — task management powered by sbtask";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    sbtask.url = "git+file:///home/justin/development/go/sbtask";
  };

  outputs = { self, nixpkgs, flake-utils, sbtask, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # ── Svelte frontend (static assets) ───────────────────────────
        prowl-frontend-desktop = pkgs.stdenv.mkDerivation {
          pname = "prowl-frontend-desktop";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = with pkgs; [
            nodejs-slim_22
            pnpm
          ];

          buildPhase = ''
            export HOME=$TMPDIR
            pnpm install --no-frozen-lockfile
            pnpm exec vite build --config vite.config.desktop.ts
          '';

          installPhase = ''
            mkdir -p $out
            cp -r desktop/frontend/dist/* $out/
          '';
        };

        # ── Prowl desktop app (Wails + Go) ───────────────────────────
        prowl-desktop = pkgs.stdenv.mkDerivation {
          pname = "prowl-desktop";
          version = "0.1.0";
          src = ./desktop;

          nativeBuildInputs = with pkgs; [
            pkg-config
            wrapGAppsHook3
            go
          ];

          buildInputs = with pkgs; [
            webkitgtk_6_0
            gtk3
          ];

          preBuild = ''
            mkdir -p frontend/dist
            cp -r ${prowl-frontend-desktop}/* frontend/dist/
          '';

          buildPhase = ''
            export HOME=$TMPDIR
            go build -ldflags="-s -w" -o prowl-desktop .
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp prowl-desktop $out/bin/
          '';

          meta = with pkgs.lib; {
            description = "Desktop task management powered by sbtask";
            homepage = "https://github.com/justin/prowl";
            license = licenses.mit;
            mainProgram = "prowl-desktop";
            platforms = platforms.linux;
          };
        };

      in
      {
        packages = {
          inherit prowl-frontend-desktop prowl-desktop;
          inherit (sbtask.packages.${system}) sbtask;
          default = prowl-desktop;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            go gopls delve
            nodejs-slim_22 pnpm
            wails pkg-config
            webkitgtk_6_0 gtk3
            sbtask.packages.${system}.sbtask
          ];
        };

        apps.default = {
          type = "app";
          program = "${prowl-desktop}/bin/prowl-desktop";
        };
      }
    );
}
