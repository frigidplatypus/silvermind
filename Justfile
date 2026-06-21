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

# ── iOS / Capacitor ──────────────────────────────────────────────────────────

# Cross-compile sbtask for iOS arm64
sbtask-fetch:
    pnpm sbtask:fetch

# Sync Capacitor iOS project
cap-sync:
    pnpm cap:sync

# Open iOS project in Xcode
cap-open:
    pnpm cap:open

# Full iOS build (dist + fetch + sync)
build-ios: dist-mobile sbtask-fetch cap-sync
    @echo "✓ iOS assets ready — open with 'just cap-open'"

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
