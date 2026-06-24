# ── Silvermind Build Automation ──────────────────────────────────────────────
# Run `just --list` to see available recipes.

# Environment ─────────────────────────────────────────────────────────────────
cgo_enabled := "1"
cgo_cflags  := "-Wno-error=incompatible-pointer-types"
go_tags     := "desktop production webkit2_41"
go_ldflags  := "-s -w"

dist_dir    := "desktop/frontend/dist"
binary_name := "silvermind-desktop"
binary_path := "desktop/" + binary_name

# Default recipe ──────────────────────────────────────────────────────────────
default: list

# ── Desktop binary ──────────────────────────────────────────────────────────

# Build the desktop binary (frontend dist + go build)
build: dist check-dist
    cd desktop && \
    CGO_ENABLED={{cgo_enabled}} CGO_CFLAGS='{{cgo_cflags}}' \
    go build -tags '{{go_tags}}' -ldflags='{{go_ldflags}}' \
    -o {{binary_name}} .
    @echo "✓ Built {{binary_path}}"

# Build and run the desktop binary
run: build
    ./{{binary_path}}

# Build just the Go binary (skip frontend — assumes dist is up-to-date)
build-go:
    cd desktop && \
    CGO_ENABLED={{cgo_enabled}} CGO_CFLAGS='{{cgo_cflags}}' \
    go build -tags '{{go_tags}}' -ldflags='{{go_ldflags}}' \
    -o {{binary_name}} .
    @echo "✓ Built {{binary_path}}"

# ── Frontend ────────────────────────────────────────────────────────────────

# Install JS dependencies
install:
    pnpm install

# Build the Svelte frontend for desktop (outputs to desktop/frontend/dist/)
dist:
    pnpm build:desktop

# Start Vite dev server (mobile/web — proxied to :7433)
dev-web:
    pnpm dev

# Start Vite dev server (desktop config — outputs to desktop/frontend/dist/)
dev-dist:
    pnpm build:desktop --watch

# Build mobile/web frontend
dist-mobile:
    pnpm build

# ── Verification ─────────────────────────────────────────────────────────────

# Verify frontend dist exists (fails with helpful message if missing)
check-dist:
    @if [ ! -f {{dist_dir}}/index.html ]; then \
        echo "ERROR: {{dist_dir}}/ is empty. Run 'pnpm build:desktop' first."; \
        exit 1; \
    fi

# ── Web GUI ──────────────────────────────────────────────────────────────────

web_dist_dir := "frontend/dist"

# Build the Svelte frontend for web GUI (outputs to frontend/dist/)
build-web:
    pnpm build:web

# Build sbtask CLI binary (backend/)
build-sbtask:
    cd backend && go build -o ../sbtask ./cmd/sbtask
    @echo "✓ Built sbtask"

# Run sbtask serve with web GUI enabled
serve-web: build-web build-sbtask
    @echo "Starting sbtask serve with web GUI at http://localhost:9876"
    cd backend && ../sbtask serve --web-gui ../{{web_dist_dir}}

# ── iOS / Capacitor ──────────────────────────────────────────────────────────

# Cross-compile sbtask for iOS arm64
sbtask-fetch:
    pnpm sbtask:fetch

# Cross-compile sbtask for Android arm64
sbtask-fetch-android:
    bash scripts/fetch-sbtask.sh android

# Sync Capacitor iOS project
cap-sync:
    pnpm cap:sync

# Sync Capacitor Android project
cap-sync-android:
    pnpm cap:sync:android

# Open iOS project in Xcode
cap-open:
    pnpm cap:open

# Open Android project in Android Studio
cap-open-android:
    pnpm cap:open:android

# Full iOS build (dist + fetch + sync)
build-ios: dist-mobile sbtask-fetch cap-sync
    @echo "✓ iOS assets ready — open with 'just cap-open'"

# Install Android custom plugin into generated project
# Auto-generates the Android project if it doesn't exist (first time setup)
install-android-plugin:
    @if [ ! -d android/app/src/main/java/ai/silvermind/app ]; then \
        echo "[prowl] Android project not found — running cap add android..."; \
        npx cap add android; \
    fi
    bash scripts/install-android-plugin.sh

# Full Android build (dist + fetch + install-plugin + sync)
build-android: dist-mobile sbtask-fetch-android install-android-plugin cap-sync-android
    @echo "✓ Android assets ready — open with 'just cap-open-android'"

# Build and install APK to connected device via adb
install-android: build-android
    @for cmd in npx pnpm go java adb; do \
        if ! command -v $cmd >/dev/null 2>&1; then \
            echo "ERROR: '$cmd' not found. Run this first:"; \
            echo "  nix develop .#android"; \
            exit 1; \
        fi; \
    done
    cd android && ./gradlew assembleDebug && adb install -r app/build/outputs/apk/debug/app-debug.apk
    @echo "✓ Installed on connected device"

# ── Nix ──────────────────────────────────────────────────────────────────────

# Build with Nix (frontend dist must exist first — run 'just dist')
nix-build: check-dist
    nix build .#silvermind-desktop
    @echo "✓ Nix build: result/bin/{{binary_name}}"

# Enter Nix dev shell
shell:
    nix develop

# ── Housekeeping ─────────────────────────────────────────────────────────────

# Clean all build artifacts
clean:
    rm -rf dist/
    rm -rf {{dist_dir}}/
    rm -f {{binary_path}}
    @echo "✓ Cleaned"

# ── Utilities ────────────────────────────────────────────────────────────────

# List available recipes
list:
    @just --list

# Print build environment info
info:
    @echo "binary:  {{binary_path}}"
    @echo "cgo:     {{cgo_enabled}}"
    @echo "cflags:  {{cgo_cflags}}"
    @echo "tags:    {{go_tags}}"
    @echo "ldflags: {{go_ldflags}}"
    @pnpm --version
    @go version
