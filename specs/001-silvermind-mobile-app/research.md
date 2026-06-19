# Research: Silvermind Mobile App

**Date**: 2026-06-18
**Feature**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

This document records the key technical decisions and best practices used to design Silvermind. Each section captures: the **Decision**, the **Rationale**, and **Alternatives considered**.

## 1. UI Framework: Svelte 5 with Runes Mode

**Decision**: Use Svelte 5 with runes mode (`$state`, `$derived`, `$effect`) for all reactive state.

**Rationale**:
- The spec explicitly requires Svelte 5 with runes mode. Runes provide fine-grained reactivity that aligns with the perf targets (60fps scrolling, <1s interactions).
- Runes reduce bundle size and runtime overhead compared to Svelte 4's compiler magic, supporting the <3s launch target.
- Native-feeling UX benefits from fine-grained DOM updates Svelte is known for.

**Alternatives considered**:
- Svelte 4 (legacy stores): rejected by spec requirement; less granular reactivity.
- React 19: explicitly rejected by spec ("no React Native").
- Solid.js: lighter, but spec mandates Svelte.

## 2. Native Shell: Capacitor 6+

**Decision**: Use Capacitor 6+ as the iOS native shell, wrapping the Svelte web app in a WKWebView.

**Rationale**:
- Spec mandates Capacitor.
- Capacitor 6 supports modern iOS 16+ and Swift 5.9+ plugin shims.
- WebView gives us the full Svelte tooling (Vite, TypeScript) while exposing native APIs via plugin bridges.
- Capacitor Cloud Build (EAS) is supported for Linux-based iOS builds.

**Alternatives considered**:
- Cordova: legacy, less active, weaker plugin ecosystem for modern iOS APIs (Siri, etc.).
- Native SwiftUI app: would require abandoning the Svelte UI; spec requires Svelte.

## 3. Embedding and Launching the sbtask Binary

**Decision**: Bundle the sbtask binary as an iOS app resource, copy it to a writable location on first launch, and spawn it from a custom Capacitor Swift plugin (`sbtask-ios`). The plugin manages process lifecycle: start on app launch, watch for crash, restart on demand.

**Rationale**:
- iOS apps cannot execute a binary from the bundle directly at runtime (sandbox + codesign restrictions). The binary must be copied out of the bundle to a writable directory (e.g., `Library/Application Support/sbtask/`) and `chmod +x`'d.
- A custom Capacitor plugin is the cleanest way to expose `start`, `stop`, `isRunning`, and `onExit` to the JS layer.
- The binary must be CGO_ENABLED=0 to avoid glibc/dynamic linking issues on iOS.

**Alternatives considered**:
- Static linking sbtask into a Swift shim: rejected — sbtask is a CLI tool with its own flag parsing, signal handling, and serve logic; embedding it in-process would require forking.
- Running sbtask outside the app sandbox via jailbreak: rejected — not allowed on App Store apps.
- Using `posix_spawn` directly from a Capacitor plugin: this is what we picked.

## 4. Communication: Direct fetch to localhost

**Decision**: Use the standard `fetch` API in Svelte to call the sbtask REST API on `http://127.0.0.1:<port>`.

**Rationale**:
- iOS App Transport Security (ATS) allows HTTP to localhost without exceptions when using the loopback address.
- Svelte 5 runes integrate cleanly with `fetch` (via `$state` and `$effect`).
- No need for a heavy client library — the API is small and well-defined.

**Alternatives considered**:
- WebSocket: not needed; sbtask exposes REST.
- gRPC: rejected — sbtask speaks REST per spec.
- Capacitor HTTP plugin: not needed for localhost.

## 5. State Management: Svelte 5 Runes + Capacitor Preferences

**Decision**: Use Svelte 5 runes (`$state`) for in-memory reactive state. Persist only the active space selection via Capacitor Preferences.

**Rationale**:
- All task data lives in sbtask — the UI is a view layer, not a cache.
- Persisted state is minimal: last selected space.
- Runes give us per-component reactivity without a global store library.

**Alternatives considered**:
- Svelte 4 stores: works but spec mandates runes.
- Redux/Zustand: overkill for the limited state we have.

## 6. Native Plugin Set

**Decision**:
- `@capacitor/haptics` for tactile feedback on task completion, creation, deletion.
- `@capacitor/status-bar` to match the app's light/dark theme and integrate with the iOS status bar.
- `@capacitor/splash-screen` to cover the splash period while sbtask boots.
- A custom `sbtask-ios` plugin for process lifecycle (binary spawn, health, restart).
- For Siri Shortcuts: `@capacitor-community/siri-shortcuts` (or a thin custom plugin wrapping iOS App Intents) for "create task" and "open view" intents.

**Rationale**:
- These are the most stable, widely-adopted Capacitor plugins for each need.
- Siri Shortcuts on modern iOS uses App Intents (iOS 16+) — the plugin must be compatible.
- All are first-party or community-maintained under the Capacitor org.

**Alternatives considered**:
- Custom Swift plugin for everything: rejected — increases maintenance, slower development.
- Using a non-Capacitor native bridge: rejected — spec mandates Capacitor.

## 7. List Virtualization for 100+ Items

**Decision**: Use Svelte's built-in `<svelte:window>` and reactive list rendering with keyed each blocks. For 100+ items, this performs well; if profiling shows jank, add a virtualized list library (e.g., `svelte-virtual-list`).

**Rationale**:
- Svelte's compiler eliminates the virtual DOM diff for unchanged rows, making 100+ items trivial.
- 60fps target is achievable with keyed `<each>` for typical task list sizes.
- Virtualization is a fallback, not a default — avoid premature optimization.

**Alternatives considered**:
- `svelte-virtual-list` immediately: rejected — adds dependency; defer until profiling shows need.
- `svelte-virtual` (newer): same trade-off, defer.

## 8. Swipe Gestures

**Decision**: Implement swipe-to-complete as a custom Svelte component using pointer events, or use a small library like `svelte-gestures`. Avoid heavy gesture frameworks.

**Rationale**:
- Swipe-to-done is the single gesture we need. A custom implementation is ~50 lines and gives full control over the animation and haptics.
- Avoids pulling in a 50KB+ gesture library for one interaction.

**Alternatives considered**:
- `svelte-dnd-action`: drag-and-drop, not swipe.
- `use-gesture`: overkill for a single swipe direction.
- Native iOS `UISwipeActionsConfiguration` via a Capacitor plugin: tempting for native feel, but adds another custom plugin for a feature the WebView can do well.

## 9. Accessibility Implementation

**Decision**: 
- All interactive elements get `aria-label` / `aria-labelledby`.
- Use semantic HTML (`<button>`, `<input>`, `<nav>`, `<main>`).
- Text sizes use relative units (`rem`) to support Dynamic Type.
- Detect reduced motion via `(prefers-reduced-motion: reduce)` and disable non-essential animations.
- Color contrast verified against WCAG AA (4.5:1 for normal text, 3:1 for large text).

**Rationale**:
- Spec requires full accessibility (clarification Q3).
- Native HTML semantics plus ARIA covers most VoiceOver cases.
- `prefers-reduced-motion` is the standard CSS media query supported by iOS Safari.

**Alternatives considered**:
- Custom VoiceOver announcements: not needed if HTML semantics are correct.
- 3rd-party a11y library: rejected — native HTML is sufficient.

## 10. iOS Build & Distribution

**Decision**: Build the iOS app on Linux via Capacitor Cloud Build (EAS) or similar cloud Xcode service. Bundle the sbtask binary as part of the build artifact.

**Rationale**:
- Spec mandates cloud build (no macOS in the dev environment).
- EAS and similar services support Capacitor apps with custom plugins.
- The sbtask binary fetch step can run as a pre-build script.

**Alternatives considered**:
- macOS-required local Xcode build: rejected by spec.
- Cross-compile iOS apps on Linux directly: not feasible for App Store distribution.

## 11. Localhost Port Strategy

**Decision**: sbtask `serve` listens on a fixed port (e.g., 7433 — a non-privileged high port). Silvermind's API client always calls `http://127.0.0.1:7433/`. The port is documented in the contracts as a constant.

**Rationale**:
- Fixed port simplifies the client and avoids discovery overhead.
- High non-privileged port avoids conflicts with system services.
- iOS allows loopback HTTP without ATS exceptions.

**Alternatives considered**:
- Random port negotiated via IPC: rejected — adds complexity, no benefit.
- Unix domain socket: rejected — WebViews and `fetch` don't easily speak UDS.

## 12. Service Health Monitoring

**Decision**: The `sbtask-ios` Capacitor plugin polls the local service every 2 seconds via a health endpoint (or short HEAD/GET on `/tasks`). On missed polls, the plugin attempts a restart (up to 3 retries) and emits a `service-down` / `service-up` event to the JS layer.

**Rationale**:
- Polling is simple and reliable for a localhost service.
- 2s interval balances responsiveness with battery cost.
- Bounded retries prevent restart loops.

**Alternatives considered**:
- Event-driven (Capacitor plugin watches the spawned process via `waitpid`): more efficient but harder to expose to JS.
- Heartbeat from the service: requires sbtask changes.

## 13. Edge Case: No Spaces Configured

**Decision**: If sbtask has no spaces configured, the app falls back to a virtual default space named "Inbox" backed by the same `/inbox` endpoint. Users can configure real spaces via the sbtask CLI on their dev machine; the app reflects whatever sbtask reports.

**Rationale**:
- The app is read/write against sbtask — it doesn't define spaces itself.
- A default space keeps the app usable for first-time users.
- Configuring spaces via the CLI is a power-user concern, not a Silvermind concern.

**Alternatives considered**:
- In-app space configuration: rejected — out of scope; belongs to sbtask CLI.
- Block the app until spaces exist: rejected — too restrictive.

## 14. Siri Shortcuts Specifics

**Decision**: Define two Siri Shortcut intents:
1. **Add Task** — accepts a title string parameter, creates a task in the current active space, returns success.
2. **Open Inbox** / **Open Today** — opens the app to the corresponding view.

**Rationale**:
- "Create task" is the highest-value voice action for a task manager.
- "Open view" is useful for routines ("Hey Siri, show me today's tasks").
- Both are feasible via iOS App Intents with a custom Capacitor plugin.

**Alternatives considered**:
- Full natural language task creation with due date parsing: deferred — complex, lower priority.
- Siri-only "complete task" intent: deferred — voice completion is awkward; user wants visual confirmation.

## 15. Data Model: Source of Truth is sbtask

**Decision**: Silvermind is a thin client. All task and space data is owned by sbtask. Silvermind fetches and renders it; sbtask persists it. Silvermind does not maintain a local database or sync engine.

**Rationale**:
- Spec describes Silvermind as a UI wrapper around sbtask.
- Single source of truth eliminates sync conflicts.
- Simplifies the app dramatically — no SQLite, no migrations.

**Alternatives considered**:
- Local SQLite cache: rejected — adds complexity and sync logic.
- Offline write queue with replay: rejected — sbtask is always local; no offline scenario beyond "sbtask crashed" which is handled by the plugin.

## 16. Sort Customization

**Decision**: Inbox default sort is priority-then-creation-date (per clarification Q2). A sort menu offers alternatives: creation date only, due date, alphabetical by title. The chosen sort persists in-memory for the session (not across launches).

**Rationale**:
- Per-task-force sort preference is low-value; session-level is sufficient.
- Persisting to sbtask would be a state-management concern better left out of v1.

**Alternatives considered**:
- Persist sort to sbtask config: deferred.
- Per-space sort preference: deferred.

## Open Questions / Deferred to Tasks

- Exact polling interval for service health (chosen 2s — may need tuning).
- Exact retry count and backoff for service restart (chosen 3, immediate — may need jittered backoff).
- Exact port for sbtask (chosen 7433 — final value TBD if conflicts with sbtask conventions).
- sbtask config file location on iOS sandbox (TBD at implementation; assume `Library/Application Support/sbtask/config.yaml`).
