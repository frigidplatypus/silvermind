# Quickstart: Silvermind Desktop Layout

**Date**: 2026-06-19
**Feature**: [spec.md](./spec.md)

## Prerequisites

- NixOS or Linux with Nix installed
- Go 1.26+ (provided by Nix)
- Node.js 22+ + pnpm (provided by Nix)
- WebKitGTK (standard on Linux desktops)
- sbtask source at `/home/justin/development/go/sbtask`

## One-Time Setup

```bash
# From the silvermind repo root
cd silvermind

# Build the Svelte frontend for desktop (strips Capacitor)
pnpm exec vite build --config vite.config.desktop.ts

# Initialize Wails project (first time only)
cd desktop
go mod init silvermind
go mod edit -replace github.com/justin/sbtask=../go/sbtask
go mod tidy
```

## Build & Run

```bash
# Build the Svelte assets for desktop
pnpm exec vite build --config vite.config.desktop.ts

# Build and run the Wails app
cd desktop
go build -o silvermind .
./silvermind
```

Expected: A native window opens at ~1200x800, showing the sidebar on the left, split-pane with inbox tasks in the center, and detail panel on the right. The quick capture bar is at the top.

## Validation Scenarios

### Scenario 1: Desktop Shell Launch (US1)

1. Run `./silvermind`
2. Verify a native window opens within 3 seconds (SC-001)
3. Verify the sidebar shows Inbox, Today, Settings
4. Click Today — verify the main area switches to Today view
5. Resize the window — verify sidebar stays fixed width
6. Close the window — verify clean shutdown (no process left on :7433)

### Scenario 2: Split Pane (US2)

1. Launch the app
2. Click a task in the task list — verify detail appears in the right panel
3. Click Edit — verify editor opens inline in the right panel (no overlay)
4. Drag the divider left — verify both panels resize
5. Resize window below 800px — verify layout collapses to mobile mode (SC-007)

### Scenario 3: Config Manager (US3)

1. Open Settings
2. Click "Add Space" — verify a dialog appears
3. Enter name "Test", URL "http://localhost:3000" — submit
4. Verify the new space appears in the space switcher
5. Click "Edit" on the new space — verify dialog is pre-filled
6. Click "Remove" — verify confirmation dialog, confirm, space removed

### Scenario 4: Keyboard Shortcuts (US4)

1. Press Ctrl+N — verify quick capture focuses
2. Press Esc — verify quick capture blurs
3. Press j/k — verify task list selection moves
4. Press Space — verify selected task toggles done/undo
5. Press 1, 2, 3 — verify sidebar switches views

### Scenario 5: Quick Capture Top Bar (US5)

1. Verify quick capture input is visible at the top of all views (Inbox, Today, Settings)
2. Type "Test task" and press Enter
3. Verify task appears in the task list

### Scenario 6: Cross-Platform Consistency

1. Build the mobile app (`pnpm build && pnpm cap sync ios`)
2. Build the desktop app (`pnpm exec vite build --config vite.config.desktop.ts && cd desktop && go build`)
3. Verify both compile from the same `src/` directory
4. Verify desktop build does not include Capacitor plugins (check binary size <20MB, SC-004)

## CI Build

```bash
# Desktop build
pnpm exec vite build --config vite.config.desktop.ts
cd desktop && go build -o silvermind . && cd ..
# Verify binary exists and is reasonable size
test -f desktop/silvermind
test $(stat -c%s desktop/silvermind) -lt 20000000  # <20MB
```

## Troubleshooting

- **WebKitGTK not found**: Install via Nix: `pkgs.webkitgtk` in your shell.nix or devenv.nix.
- **sbtask import fails**: Verify the `replace` directive in `desktop/go.mod` points to the correct sbtask path.
- **Vite build fails**: Ensure `vite.config.desktop.ts` exists and excludes Capacitor plugins.
- **Port 7433 in use**: Kill stale sbtask processes before launching: `fuser -k 7433/tcp`.
