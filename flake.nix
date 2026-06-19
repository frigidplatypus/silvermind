{
  description = "Silvermind — task management powered by sbtask";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    sbtask.url = "git+file:///home/justin/development/go/sbtask";
  };

  outputs = { self, nixpkgs, flake-utils, sbtask, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # ── Svelte frontend ──────────────────────────────────────────
        silvermind-frontend-desktop = pkgs.stdenv.mkDerivation {
          pname = "silvermind-frontend-desktop";
          version = "0.1.0";
          src = ./.;

          nativeBuildInputs = with pkgs; [ nodejs-slim_22 pnpm ];

          buildPhase = ''
            export HOME=$TMPDIR
            cd $src
            pnpm install --no-frozen-lockfile
            pnpm exec vite build --config vite.config.desktop.ts
          '';

          installPhase = ''
            mkdir -p $out
            cp -r desktop/frontend/dist/* $out/
          '';
        };

        # ── Silvermind desktop app ────────────────────────────────────────
        silvermind = pkgs.stdenv.mkDerivation {
          pname = "silvermind";
          version = "0.1.0";
          src = ./desktop;

          nativeBuildInputs = with pkgs; [
            pkg-config wrapGAppsHook3 go
          ];

          buildInputs = with pkgs; [ webkitgtk_6_0 gtk3 ];

          preBuild = ''
            mkdir -p frontend/dist
            cp -r ${silvermind-frontend-desktop}/* frontend/dist/
            export HOME=$TMPDIR
          '';

          buildPhase = ''
            go build -ldflags="-s -w" -o silvermind .
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp silvermind $out/bin/
          '';

          meta = with pkgs.lib; {
            description = "Desktop task management powered by sbtask";
            homepage = "https://github.com/justin/silvermind";
            license = licenses.mit;
            mainProgram = "silvermind";
            platforms = platforms.linux;
          };
        };

      in
      {
        packages = {
          inherit silvermind-frontend-desktop silvermind;
          inherit (sbtask.packages.${system}) sbtask;
          default = silvermind;
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
          program = "${silvermind}/bin/silvermind";
        };
      }
    );
}
