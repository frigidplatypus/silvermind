# Implementation Plan: Silvermind Desktop Layout

**Branch**: `002-desktop-layout` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-desktop-layout/spec.md`

## Summary

Add a Wails v3 desktop wrapper around the existing Svelte 5 Silvermind codebase. The Go backend embeds sbtask as a library (via local `replace` directive), starts `serve` in-process on localhost:7433, and exposes an AppService for configuration management. The Svelte frontend gains a desktop-optimized layout (sidebar nav, split pane, top bar quick capture) via CSS media queries at 800px breakpoint. Keyboard shortcuts provide power-user navigation. The same `src/` tree serves both mobile (Capacitor) and desktop (Wails) from a single codebase.

## Technical Context

**Language/Version**:
- Go 1.26+ (Wails v3 backend + sbtask library import)
- TypeScript 5.x / Svelte 5 runes (shared frontend, same as mobile)

**Primary Dependencies**:
- Wails v3 (desktop shell — native window, WebKitGTK WebView)
- sbtask (Go library, imported via `replace` directive — `pkg/serve` directly)
- Svelte 5 + Vite (same build toolchain as mobile)
- Feather Icons (already in use)
- No Capacitor plugins on desktop (haptics/status-bar/splash degrade to no-ops)

**Storage**:
- sbtask config: `~/.config/sbtask/config.yaml` — read/written by Wails Go backend
- App preferences (theme): `localStorage` (same as mobile)
- No new persistence layer needed

**Testing**:
- Go tests for Wails AppService (sbtask lifecycle, config CRUD)
- Svelte component tests (existing Vitest — run same suite)
- Manual end-to-end: launch binary, verify layout, keyboard shortcuts

**Target Platform**: Linux (WebKitGTK), NixOS development environment

**Project Type**: Desktop app (Wails v3 + Svelte 5 — single binary)

**Performance Goals**:
- App launch + inbox display: <3 seconds
- sbtask serve health: <500ms
- Split pane resize: within one frame (16ms)
- Keyboard shortcuts: <200ms response
- Binary size: <20MB
- Space switch: <1s

**Constraints**:
- Same Svelte codebase as mobile (no fork)
- sbtask imported as Go library, not spawned as process
- Wails v3 service pattern for Go↔JS communication
- Linux-only v1
- No Electron, no Tauri

**Scale/Scope**:
- ~5 new Go source files (main.go, app.go, service.go, config.go + Wails boilerplate)
- ~3 new Svelte components (desktop-layout wrapper, sidebar, split-pane)
- ~2 modified Svelte files (main.ts → adaptive entry, +layout.svelte → media query)
- 14 functional requirements, 5 user stories

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution at `.specify/memory/constitution.md` is a placeholder template with no ratified principles. No gates enforced.

**Verdict**: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/002-desktop-layout/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── app-service.md      # Wails Go AppService contract
│   └── desktop-layout.md   # Desktop layout state + CSS breakpoints
└── tasks.md
```

### Source Code (repository root)

```text
# Go backend (new)
desktop/
├── main.go                  # Wails v3 entry point
├── app.go                   # App struct, sbtask lifecycle
├── service.go               # AppService (config CRUD, health)
├── config.go                # Config file read/write
├── go.mod                   # replace sbtask → local path
├── go.sum
└── wails.json               # Wails project config

# Svelte frontend (shared with mobile — existing files modified)
src/
├── main.ts                  # Updated: Wails entry + Capacitor entry
├── lib/
│   ├── stores/
│   │   └── (unchanged)
│   ├── components/
│   │   ├── DesktopShell.svelte    # NEW: sidebar + split pane wrapper
│   │   ├── Sidebar.svelte         # NEW: persistent left nav
│   │   ├── SplitPane.svelte       # NEW: resizable two-column
│   │   └── (other components unchanged)
│   └── native/
│       └── (haptics/splash/status-bar → no-op on desktop, already handled)
├── routes/
│   └── +layout.svelte       # Modified: media query for desktop vs mobile
└── vite.config.desktop.ts   # NEW: desktop build config (no Capacitor)
```

**Structure Decision**: The Go backend lives in a new `desktop/` directory adjacent to `src/`. The Svelte frontend gains desktop layout components that augment (not replace) the existing mobile components. A separate `vite.config.desktop.ts` handles the Wails build (embedding static assets), while the existing `vite.config.ts` continues to serve the Capacitor mobile build.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | _n/a_ | _n/a_ |
