# Research: Prowl Desktop Layout

**Date**: 2026-06-19
**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## 1. Wails v3 Integration

**Decision**: Use Wails v3 with the service pattern. Go backend exposes an `AppService` struct with methods for sbtask lifecycle management and config CRUD. Frontend calls Go methods via `@wailsio/runtime`. Native dialogs use `window.runtime.WindowDialogs()`.

**Rationale**:
- Service pattern is Wails v3's recommended approach — clean separation between Go logic and Svelte UI
- `@wailsio/runtime` provides type-safe Go↔JS bindings generated from Go struct methods
- Native dialogs (file picker, confirm, alert) feel correct on Linux without polluting the WebView

**Alternatives considered**:
- Wails v2 binding pattern: rejected — v3 uses an event-based service pattern (vs v2's RPC-style bindings), has a smaller runtime, and provides improved TypeScript support
- Electron: rejected — 120MB+ binary size vs ~5MB with Wails. Spec explicitly excludes Electron.
- Tauri: rejected — adds Rust toolchain. Spec explicitly excludes Tauri.

## 2. sbtask Library Import

**Decision**: Import sbtask's `pkg/serve` directly as a Go library via a local `replace` directive in `go.mod`. The `app.go` file imports `github.com/justin/sbtask/pkg/serve` and calls `serve.Start()` in-process.

**Rationale**:
- No child process, no IPC overhead, no binary bundling
- sbtask serve is already a Go library — the `serve` subcommand just wraps it in a CLI
- Local `replace` directive allows co-development without pushing tags

**Alternatives considered**:
- Spawning sbtask binary: rejected — spec requires library import, not process management
- Git remote import: rejected — requires pushing before using, breaks co-development flow

## 3. Dual Build: Desktop vs Mobile

**Decision**: Two Vite configs. `vite.config.ts` (existing, unchanged) builds for Capacitor/mobile. `vite.config.desktop.ts` (new) builds for Wails — same source tree, but excludes Capacitor-specific plugins and produces plain static assets in `desktop/frontend/dist/`.

**Rationale**:
- Same Svelte codebase, 100% code reuse — only the build target differs
- Desktop build strips Capacitor references (no `@capacitor/*` imports bundled)
- Wails embeds the `dist/` directory at compile time via its `embed` directive

**Alternatives considered**:
- Single Vite config with env-based conditionals: rejected — risk of bundling Capacitor into desktop binary
- Separate `src/` trees: rejected — violates FR-010 (single codebase)

## 4. Desktop Layout Architecture

**Decision**: CSS media query at 800px breakpoint toggles between desktop and mobile layouts. Desktop layout uses CSS Grid: sidebar (fixed 220px) + main area (1fr, split pane inside). The split pane uses a lightweight custom component with pointer events for dragging.

**Rationale**:
- No JavaScript routing change — the same Svelte components render, just styled differently
- 800px breakpoint matches standard tablet/desktop boundary
- Custom split pane avoids heavy JS library dependencies

**Alternatives considered**:
- Separate SvelteKit routes for desktop: rejected — duplicates component logic
- `splitpanes` npm package: rejected — adds dependency for a simple interaction

## 5. Keyboard Shortcuts

**Decision**: Global `keydown` listener in the root layout, filtered by `Ctrl`/`Shift` modifiers and current focus context. Shortcuts only fire when no input/textarea is focused (except `/` which explicitly focuses search).

**Rationale**:
- Single listener is efficient and centralized
- Context-aware filtering prevents shortcuts from breaking text input
- j/k navigation maps to Vim conventions familiar to power users

**Alternatives considered**:
- Per-component keyboard handlers: rejected — harder to maintain, conflicts between components
- Mousetrap library: rejected — adds dependency for a small feature

## 6. Config Manager

**Decision**: Go-side config CRUD via the AppService. Frontend sends `addSpace`, `editSpace`, `removeSpace`, `setActiveSpace` calls. Go reads/writes `~/.config/sbtask/config.yaml` and notifies the frontend of changes via Wails events.

**Rationale**:
- YAML parsing in Go is straightforward (already a dependency of sbtask)
- Config file is the same format sbtask CLI uses — no migration needed
- Native file dialog for import/export could be added later

**Alternatives considered**:
- Frontend config manager with localStorage: rejected — must write to the standard sbtask config file
- Electron dialog: rejected — Wails provides native dialogs

## 7. Native Dialogs

**Decision**: Use Wails v3's built-in dialog API (`window.runtime.WindowDialogs()`) for confirmation dialogs (delete space, overwrite config) and error alerts (sbtask startup failure).

**Rationale**:
- Native dialogs feel like first-class Linux apps
- No HTML/CSS dialog needed — faster, more accessible
- Part of Wails v3 runtime, no extra dependency

**Alternatives considered**:
- Svelte modal: rejected — spec requires native dialogs for config manager
- WebView `alert()`/`confirm()`: rejected — looks cheap on desktop

## 8. Graceful Degradation for Mobile-Only Features

**Decision**: Capacitor plugins (`@capacitor/haptics`, `@capacitor/status-bar`, `@capacitor/splash-screen`) are already wrapped with `try/catch` and silently no-op when Capacitor is unavailable. No code changes needed — the desktop build just doesn't include them.

**Rationale**:
- Existing wrappers already handle the no-Capacitor case
- Vite tree-shaking removes unused plugin imports from the desktop bundle

**Alternatives considered**:
- Conditional imports: rejected — adds complexity for no benefit
- Desktop-specific wrappers: rejected — the generic try/catch pattern already works

## Open Questions / Deferred to Tasks

- Exact Wails v3 project scaffold structure (subject to Wails v3 final API)
- Whether WebKitGTK needs explicit Nix packaging or is auto-detected by Wails
- Desktop Vite config: exact plugin exclusion list for Capacitor
- Split pane minimum width and default ratio (plan assumes 200px min, 66/33 default)
