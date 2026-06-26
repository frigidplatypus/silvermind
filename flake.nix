{
  description = "Silvermind — task management powered by sbtask";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
    sbtask-src.url = "path:/home/justin/development/go/sbtask";
    sbtask-src.flake = false;
  };

  outputs = { self, nixpkgs, flake-utils, sbtask-src, ... }:
    let
      eachSystem = flake-utils.lib.eachDefaultSystem (system:
        let
          pkgs = import nixpkgs {
            inherit system;
            config = {
              allowUnfree = true;
              android_sdk.accept_license = true;
            };
          };

          # ── sbtask CLI + API server (web GUI backend) ──────────────
          sbtask = pkgs.buildGoModule {
            pname = "sbtask";
            version = "0.1.0";
            src = sbtask-src;
            vendorHash = "sha256-8jBRZ5TOjjhXp/YZINvqkdMqOqLzAAQw7KLP16mVVN4=";
            proxyVendor = true;
            nativeBuildInputs = [ pkgs.go ];
            meta.mainProgram = "sbtask";
          };

          # ── Silvermind desktop app (Linux & macOS) ─────────────────
          # Frontend assets must be pre-built:
          #   pnpm build:desktop
          # This writes to desktop/frontend/dist/ which Go embeds at compile time.
          silvermind-desktop = pkgs.buildGoModule {
            pname = "silvermind-desktop";
            version = "0.1.0";
            src = ./.;                                  # whole repo so backend/ is accessible
            modRoot = "desktop";                         # go.mod lives in desktop/
            vendorHash = "sha256-UuCwmr8BYrSqyXQ1lNXXjj1uH0vogXyn0taCeCZg+z4=";
            proxyVendor = true;

            nativeBuildInputs = with pkgs; [ go ]
              ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ pkg-config wrapGAppsHook3 wails ];

            buildInputs = with pkgs;
              pkgs.lib.optionals pkgs.stdenv.isLinux [ webkitgtk_4_1 gtk3 ];

            preBuild = ''
              export HOME=$TMPDIR
              export CGO_ENABLED=1
              # Point go.mod replace to the flake's sbtask-src input
              substituteInPlace desktop/go.mod --replace-fail \
                "/home/justin/development/go/sbtask" \
                "${sbtask-src}"
            '' + pkgs.lib.optionalString pkgs.stdenv.isDarwin ''
              export CGO_LDFLAGS="-framework UniformTypeIdentifiers $CGO_LDFLAGS"
            '' + pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              export CGO_CFLAGS="-Wno-error=incompatible-pointer-types $CGO_CFLAGS"
              export NIX_CFLAGS_COMPILE="$NIX_CFLAGS_COMPILE -Wno-error=incompatible-pointer-types"
            '' + ''
              if [ ! -f frontend/dist/index.html ]; then
                echo "ERROR: frontend/dist/ is empty. Run 'pnpm build:desktop' first."
                exit 1
              fi
            '';

            tags = [ "desktop" "production" ]
              ++ pkgs.lib.optionals pkgs.stdenv.isLinux [ "webkit2_41" ];
            ldflags = [ "-s" "-w" ];

            # Linux: re-add runtime library paths that buildGoModule strips.
            # macOS: frameworks are linked at build time via CGO, no patchelf needed.
            postFixup = pkgs.lib.optionalString pkgs.stdenv.isLinux ''
              rpath="${pkgs.lib.makeLibraryPath [ pkgs.webkitgtk_4_1 pkgs.gtk3 pkgs.glib pkgs.gst_all_1.gstreamer ]}"
              patchelf --add-rpath "$rpath" $out/bin/.silvermind-desktop-wrapped
            '';

            meta = with pkgs.lib; {
              description = "Desktop task management powered by sbtask";
              homepage = "https://github.com/justin/silvermind";
              license = licenses.mit;
              mainProgram = "silvermind-desktop";
              platforms = platforms.linux ++ platforms.darwin;
            };
          };

        in
        {
          packages = {
            inherit sbtask silvermind-desktop;
            default = silvermind-desktop;
          };

          devShells.default = pkgs.mkShell {
            packages = with pkgs; [
              go gopls delve
              nodejs-slim_22 pnpm
              jdk
              android-tools
              just
            ] ++ pkgs.lib.optionals pkgs.stdenv.isLinux [
              wails pkg-config webkitgtk_4_1 gtk3
            ];
          };

          devShells.android = let
            compose = pkgs.androidenv.composeAndroidPackages {
              platformVersions = [ "34" ];
            };
            sdk = compose.androidsdk;
          in pkgs.mkShell {
            packages = with pkgs; [
              go gopls delve
              nodejs-slim_22 pnpm
              jdk
              android-tools
              just
              sdk
            ];

            ANDROID_HOME = "${sdk}/libexec/android-sdk";
            ANDROID_SDK_ROOT = "${sdk}/libexec/android-sdk";

            shellHook = ''
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

          apps = {
            default = {
              type = "app";
              program = let
                binDir = "${silvermind-desktop}/bin";
              in
                if pkgs.stdenv.isLinux
                then "${binDir}/.silvermind-desktop-wrapped"
                else "${binDir}/silvermind-desktop";
            };
            sbtask = {
              type = "app";
              program = "${sbtask}/bin/sbtask";
            };
            silvermind-web = let
              webDist = ./frontend/dist;
              runner = pkgs.writeShellScriptBin "silvermind-web" ''
                exec ${sbtask}/bin/sbtask serve --web-gui ${webDist} "$@"
              '';
            in {
              type = "app";
              program = "${runner}/bin/silvermind-web";
            };
          };
        }
      );
    in
    eachSystem // {
      homeManagerModules.default = import ./nix/hm-silvermind.nix;
    };
}
