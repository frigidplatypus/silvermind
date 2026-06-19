{
  description = "Silvermind — task management powered by sbtask";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    sbtask.url = "git+ssh://forgejo@git.fluffy-rooster.ts.net/FRGD/sbtask.git";
  };

  outputs = { self, nixpkgs, flake-utils, sbtask, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # ── Svelte frontend ──────────────────────────────────────────
        silvermind-frontend = pkgs.stdenv.mkDerivation {
          pname = "silvermind-frontend";
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
        silvermind-desktop = pkgs.stdenv.mkDerivation {
          pname = "silvermind-desktop";
          version = "0.1.0";
          src = ./desktop;

          nativeBuildInputs = with pkgs; [
            pkg-config wrapGAppsHook3 go
          ];

          buildInputs = with pkgs; [ webkitgtk_6_0 gtk3 ];

          preBuild = ''
            mkdir -p frontend/dist
            cp -r ${silvermind-frontend}/* frontend/dist/
            export HOME=$TMPDIR
          '';

          buildPhase = ''
            go build -ldflags="-s -w" -o silvermind-desktop .
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp silvermind-desktop $out/bin/
          '';

          meta = with pkgs.lib; {
            description = "Desktop task management powered by sbtask";
            homepage = "https://github.com/justin/silvermind";
            license = licenses.mit;
            mainProgram = "silvermind-desktop";
            platforms = platforms.linux;
          };
        };

      in
      {
        packages = {
          inherit silvermind-frontend silvermind-desktop;
          inherit (sbtask.packages.${system}) sbtask;
          default = silvermind-desktop;
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
          program = "${silvermind-desktop}/bin/silvermind";
        };
      }
    );
}
