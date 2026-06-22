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

          # ── Silvermind desktop app ──────────────────────────────────
        # Frontend assets must be pre-built:
        #   pnpm build:desktop
        # This writes to desktop/frontend/dist/ which Go embeds at compile time.
        silvermind-desktop = pkgs.buildGoModule {
          pname = "silvermind-desktop";
          version = "0.1.0";
          src = ./desktop;
          vendorHash = "sha256-UuCwmr8BYrSqyXQ1lNXXjj1uH0vogXyn0taCeCZg+z4=";
          proxyVendor = true;

          nativeBuildInputs = with pkgs; [ pkg-config wrapGAppsHook3 go ];
          buildInputs = with pkgs; [ webkitgtk_4_1 gtk3 ];

          preBuild = ''
            export HOME=$TMPDIR
            export CGO_ENABLED=1
            export CGO_CFLAGS="-Wno-error=incompatible-pointer-types $CGO_CFLAGS"
            export NIX_CFLAGS_COMPILE="$NIX_CFLAGS_COMPILE -Wno-error=incompatible-pointer-types"
            if [ ! -f frontend/dist/index.html ]; then
              echo "ERROR: frontend/dist/ is empty. Run 'pnpm build:desktop' first."
              exit 1
            fi
            # Point sbtask replace directive to the flake input
            SBTASK_SRC="${sbtask}"
            if [ -d "$SBTASK_SRC" ]; then
              go mod edit -replace github.com/justin/sbtask=$SBTASK_SRC
            fi
          '';

          tags = [ "desktop" "production" "webkit2_41" ];
          ldflags = [ "-s" "-w" ];

          # The Go binary needs runtime library paths for webkitgtk, gtk3, etc.
          # buildGoModule strips them; re-add in postFixup.
          postFixup = ''
            rpath="${pkgs.lib.makeLibraryPath ([ pkgs.webkitgtk_4_1 pkgs.gtk3 pkgs.glib pkgs.gst_all_1.gstreamer ])}"
            patchelf --add-rpath "$rpath" $out/bin/.silvermind-desktop-wrapped
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
          inherit silvermind-desktop;
          inherit (sbtask.packages.${system}) sbtask;
          default = silvermind-desktop;
        };

        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            go gopls delve
            nodejs-slim_22 pnpm
            wails pkg-config
            webkitgtk_4_1 gtk3
            sbtask.packages.${system}.sbtask
          ];
        };

        apps.default = {
          type = "app";
          program = "${silvermind-desktop}/bin/silvermind-desktop";
        };
      }
    );
}
