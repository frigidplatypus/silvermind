{
  description = "Silvermind — cross-platform task management for SilverBullet";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    let
      eachSystem = flake-utils.lib.eachDefaultSystem (
        system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config = {
              allowUnfree = true;
              android_sdk.accept_license = true;
            };
          };

          sentryDsn = builtins.getEnv "SILVERMIND_SENTRY_DSN";

          repoHooksShellHook = ''
            if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
              current_hooks_path="$(git config --local --get core.hooksPath || true)"
              if [ "$current_hooks_path" != ".githooks" ]; then
                git config --local core.hooksPath .githooks
                echo "[silvermind] Enabled git hooks via .githooks"
              fi
            fi
          '';

          # ── Silvermind desktop app (Linux & macOS) ─────────────────
          silvermind-desktop = pkgs.buildGoModule {
            pname = "silvermind-desktop";
            version = "0.1.0";
            src = ./.;
            modRoot = "desktop";
            vendorHash = "sha256-EDiXr48SVBQTjPtJM11zigaoNWr1BhmOgH9pI7BSM1U=";
            proxyVendor = true;

            nativeBuildInputs =
              with pkgs;
              [ go ]
              ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
                pkg-config
                wrapGAppsHook3
                wails
                makeWrapper
              ];

            buildInputs =
              with pkgs;
              pkgs.lib.optionals pkgs.stdenv.isLinux [
                webkitgtk_4_1
                gtk3
                libnotify
              ];

            preBuild = ''
              export HOME=$TMPDIR
              export CGO_ENABLED=1

              if [ ! -f frontend/dist/index.html ]; then
                echo "ERROR: desktop/frontend/dist is missing. Run 'just dist' before nix build." >&2
                exit 1
              fi
            ''
            + pkgs.lib.optionalString pkgs.stdenv.isDarwin ''
              export CGO_LDFLAGS="-framework UniformTypeIdentifiers $CGO_LDFLAGS"
            ''
            + pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              export CGO_CFLAGS="-Wno-error=incompatible-pointer-types $CGO_CFLAGS"
              export NIX_CFLAGS_COMPILE="$NIX_CFLAGS_COMPILE -Wno-error=incompatible-pointer-types"
            '';

            tags = [
              "desktop"
              "production"
            ]
            ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ "webkit2_41" ];
            ldflags = [
              "-s"
              "-w"
            ]
            ++ pkgs.lib.optional (sentryDsn != "") "-X main.sentryDsn=${sentryDsn}";

            postInstall = pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              mkdir -p $out/share/applications
              cp ../packaging/ai.silvermind.app.desktop $out/share/applications/
              install -Dm644 ../packaging/ai.silvermind.app.png \
                $out/share/icons/hicolor/128x128/apps/ai.silvermind.app.png
              gtk-update-icon-cache --force --ignore-theme-index $out/share/icons/hicolor
            '';

            postFixup = pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              rpath="${
                pkgs.lib.makeLibraryPath [
                  pkgs.webkitgtk_4_1
                  pkgs.gtk3
                  pkgs.glib
                  pkgs.gst_all_1.gstreamer
                ]
              }"
              patchelf --add-rpath "$rpath" $out/bin/.silvermind-desktop-wrapped
              wrapProgram $out/bin/.silvermind-desktop-wrapped \
                --prefix PATH : ${pkgs.libnotify}/bin \
                --set WEBKIT_DISABLE_COMPOSITING_MODE 1
            '';

            meta = with pkgs.lib; {
              description = "Desktop task management for SilverBullet";
              homepage = "https://github.com/justin/silvermind";
              license = licenses.mit;
              mainProgram = "silvermind-desktop";
              platforms = platforms.linux ++ platforms.darwin;
            };
          };

        in
        {
          packages = {
            inherit silvermind-desktop;
            default = silvermind-desktop;
          };

          devShells.default = pkgs.mkShell {
            packages =
              with pkgs;
              [
                git
                go
                gopls
                nodejs-slim_22
                pnpm
                jdk
                android-tools
                just
              ]
              ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
                wails
                pkg-config
                webkitgtk_4_1
                gtk3
              ];

            shellHook = repoHooksShellHook;
          };

          devShells.android =
            let
              compose = pkgs.androidenv.composeAndroidPackages {
                platformVersions = [ "34" ];
              };
              sdk = compose.androidsdk;
            in
            pkgs.mkShell {
              packages = with pkgs; [
                git
                go
                gopls
                nodejs-slim_22
                pnpm
                jdk
                android-tools
                just
                sdk
              ];

              ANDROID_HOME = "${sdk}/libexec/android-sdk";
              ANDROID_SDK_ROOT = "${sdk}/libexec/android-sdk";

              shellHook = ''
                ${repoHooksShellHook}
                ANDROID_USER_HOME="''${XDG_CACHE_HOME:-$HOME/.cache}/silvermind-android-sdk"
                SDK_MARKER="$ANDROID_USER_HOME/.nix-sdk-version"
                CURRENT_SDK="${sdk}/libexec/android-sdk"

                if [ ! -f "$SDK_MARKER" ] || [ "$(cat "$SDK_MARKER")" != "$CURRENT_SDK" ]; then
                  echo "[silvermind] Setting up writable Android SDK at $ANDROID_USER_HOME..."
                  mkdir -p "$ANDROID_USER_HOME"
                  cp -rn "$CURRENT_SDK"/* "$ANDROID_USER_HOME/" 2>/dev/null || true
                  chmod -R u+w "$ANDROID_USER_HOME" 2>/dev/null || true
                  echo "$CURRENT_SDK" > "$SDK_MARKER"
                fi
                export ANDROID_HOME="$ANDROID_USER_HOME"
                export ANDROID_SDK_ROOT="$ANDROID_USER_HOME"
                export GRADLE_USER_HOME="''${XDG_CACHE_HOME:-$HOME/.cache}/silvermind-gradle"
              '';
            };

          devShells.flatpak = pkgs.mkShell {
            packages = with pkgs; [
              git
              flatpak
              flatpak-builder
              go
              gopls
              wails
              pkg-config
              webkitgtk_4_1
              gtk3
              nodejs-slim_22
              pnpm
              curl
            ];

            shellHook = ''
              ${repoHooksShellHook}
              if ! flatpak info org.gnome.Platform//46 &>/dev/null; then
                echo ""
                echo "  [flatpak] org.gnome.Platform//46 runtime not found."
                echo "  [flatpak] Install runtimes (one-time):"
                echo "    flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo"
                echo "    flatpak install flathub org.gnome.Platform//46 org.gnome.Sdk//46"
                echo ""
              fi
            '';
          };

          apps = {
            default = {
              type = "app";
              program =
                let
                  binDir = "${silvermind-desktop}/bin";
                in
                if pkgs.stdenv.isLinux then
                  "${binDir}/.silvermind-desktop-wrapped"
                else
                  "${binDir}/silvermind-desktop";
            };
          };
        }
      );
    in
    eachSystem
    // {
      homeManagerModules.default = import ./nix/hm-silvermind.nix;
    };
}
