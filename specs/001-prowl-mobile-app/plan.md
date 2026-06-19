# Implementation Plan: Prowl Mobile App

**Branch**: `001-prowl-mobile-app` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-prowl-mobile-app/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Prowl is a native iOS app that wraps a Svelte 5 web UI around the `sbtask` CLI tool. The app embeds a pre-compiled iOS arm64 `sbtask` binary, starts it as a local service on launch to expose a REST API on localhost, and consumes that API from the Svelte UI through a thin Capacitor shell. The technical approach is to use Capacitor 6+ to host the Svelte app inside a native iOS WebView, bundled with native plugin bridges for haptics, status bar, splash screen, and Siri Shortcuts. The build is done on Linux via Capacitor Cloud Build (EAS). All processing is local — no network, no auth.

**Terminology note**: This plan uses "sbtask" and "local task service" interchangeably. The spec uses "local task service" for functional requirements; implementation tasks and plugin code use "sbtask" as the concrete binary name. Both refer to the same thing: the `sbtask serve` process running on localhost.

## Technical Context

**Language/Version**:
- TypeScript 5.x (Svelte 5 runes mode) for the web/UI layer
- Swift 5.9+ (Capacitor iOS plugin shims, AppDelegate) for the iOS native layer
- Go (sbtask) — pre-built, no in-repo development

**Primary Dependencies**:
- Svelte 5 (runes mode) for UI framework
- Capacitor 6+ for native shell and plugin runtime
- @capacitor/haptics for haptic feedback
- @capacitor/status-bar for status bar styling
- @capacitor/splash-screen for launch screen
- @capacitor-community/siri-shortcuts (or equivalent Capacitor plugin wrapping App Intents) for Siri Shortcuts integration
- Vite for Svelte build/dev server
- A small HTTP client (fetch) for the sbtask REST API
- sbtask binary (Go, CGO_ENABLED=0, iOS arm64) — embedded as a bundle resource

**Storage**:
- sbtask manages its own task data internally (sqlite, file-backed, or whatever sbtask uses) — opaque to Prowl
- Capacitor Preferences API for the last selected space (key-value, persisted across app launches)
- Optional: lightweight in-memory cache for task list during a session

**Testing**:
- Vitest for Svelte unit/component tests
- Playwright (or equivalent) for web-layer e2e against a mock or real sbtask
- Manual on-device testing for haptics, Siri, and platform behavior
- Optional: a stub sbtask server (or `sbtask serve` against a fixture config) for end-to-end validation

**Target Platform**:
- iOS 16+ (iPhone)
- Built on Linux via Capacitor Cloud Build (EAS)
- Modern iPhone (iPhone 14 or newer) for performance targets

**Project Type**: Mobile app (Capacitor iOS — web UI inside a native shell)

**Performance Goals**:
- App launch to inbox display: <3 seconds
- Task completion via swipe to haptic + removal: <1 second
- Pull-to-refresh to updated data: <1 second
- Quick capture from app open to task created: <5 seconds
- Scrolling: 60fps with 100+ tasks in view
- Space switch: <1 second
- Service crash recovery: <5 seconds

**Constraints**:
- Offline-only (no external network)
- localhost API (127.0.0.1) only
- iOS arm64 binary (CGO_ENABLED=0) bundled with the app
- No authentication
- Memory: <200MB target
- App package size: <50MB target (mostly the sbtask binary)
- Full accessibility (VoiceOver, Dynamic Type, reduced motion, WCAG AA contrast)

**Scale/Scope**:
- 5 main views (inbox, today, task detail, space switcher, quick capture)
- Single user, no auth
- Multi-space support (2-10 typical)
- Task volumes: hundreds to low thousands per space (100+ in list, 1k+ total in storage)
- No backend, no multi-device sync (local only)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Pre-Design Check

The project constitution at `.specify/memory/constitution.md` is currently a placeholder template with no ratified principles. No constitution gates are enforced. This check will be revisited when the constitution is populated.

**Verdict (pre-design)**: PASS (no constitution violations possible — no principles defined).

### Post-Design Re-evaluation

After Phase 0 (research) and Phase 1 (data model, contracts, quickstart) design, no constitution principles exist to evaluate against. The design choices made in this plan (Capacitor 6, Svelte 5 runes, custom Swift plugin, no cloud backend) are all driven by the feature spec and clarified user intent, not by constitutional constraints.

**Verdict (post-design)**: PASS.

**Action item**: When the project constitution is ratified, re-run this check. The most likely principle candidates for Prowl (based on the design) would be:
- "Local-first / no telemetry" — the design complies (localhost only, no analytics).
- "Single source of truth" — the design complies (sbtask owns data; Prowl is a view).
- "Native feel" — the design complies (Capacitor with native plugin bridges for haptics, status bar, Siri).

## Project Structure

### Documentation (this feature)

```text
specs/001-prowl-mobile-app/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── sbtask-api.md    # The sbtask serve REST contract (consumer perspective)
│   └── ui-state.md      # UI state contract (runes, store shape)
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Web / Svelte UI (source of truth, runs inside Capacitor WebView)
src/
├── app.html
├── main.ts                       # Svelte mount
├── app.css
├── lib/
│   ├── api/
│   │   ├── client.ts             # localhost HTTP client (fetch wrapper)
│   │   ├── tasks.ts              # Task CRUD calls
│   │   ├── inbox.ts              # /inbox
│   │   ├── today.ts              # /today
│   │   ├── done.ts               # /done
│   │   ├── undo.ts               # /undo
│   │   └── spaces.ts             # Space list/selection
│   ├── stores/
│   │   ├── tasks.svelte.ts       # Task list runes
│   │   ├── space.svelte.ts       # Active space runes (persisted)
│   │   └── service.svelte.ts     # Service health/connection runes
│   ├── components/
│   │   ├── TaskList.svelte
│   │   ├── TaskRow.svelte
│   │   ├── TaskDetail.svelte
│   │   ├── TodayView.svelte
│   │   ├── QuickCapture.svelte
│   │   ├── SpaceSwitcher.svelte
│   │   ├── ServiceErrorBanner.svelte
│   │   └── SwipeRow.svelte
│   ├── views/
│   │   ├── Inbox.svelte
│   │   ├── Today.svelte
│   │   └── Detail.svelte
│   ├── native/
│   │   ├── haptics.ts            # Wraps @capacitor/haptics
│   │   ├── status-bar.ts         # Wraps @capacitor/status-bar
│   │   ├── splash.ts             # Wraps @capacitor/splash-screen
│   │   └── siri.ts               # Wraps Siri Shortcuts plugin
│   ├── accessibility/
│   │   └── motion.ts             # Reduced motion detection
│   └── service/
│       └── process.ts            # Starts sbtask serve, watches for crash
├── routes/                       # If using SvelteKit; otherwise Svelte pages
│   ├── +layout.svelte
│   ├── inbox/+page.svelte
│   ├── today/+page.svelte
│   └── task/[id]/+page.svelte
└── tests/
    ├── unit/
    └── e2e/

ios/                              # Capacitor-generated Xcode project
├── App/
│   ├── AppDelegate.swift
│   ├── Info.plist
│   └── sbtask                    # Pre-built sbtask binary, copied here as bundle resource
├── sbtask-ios/                   # Custom Capacitor plugin for spawning sbtask
│   ├── Package.swift
│   ├── Sources/
│   │   └── SbtaskPlugin/
│   │       ├── SbtaskPlugin.swift
│   │       └── SbtaskProcess.swift
│   └── README.md
└── ...

android/                          # Generated by Capacitor; not used for build target

scripts/
├── fetch-sbtask.sh               # Downloads sbtask binary from git remote
├── install-binary.sh             # Copies binary into ios/App
└── e2e-stub-server.ts            # Mock sbtask serve for e2e tests

capacitor.config.ts               # Capacitor config (appId, server url, plugins)
package.json                      # Node deps and scripts
tsconfig.json
svelte.config.js
vite.config.ts
tailwind.config.js                # If using Tailwind
README.md
```

**Structure Decision**: Option 3 (Mobile + API) is closest, but adapted for Capacitor's hybrid model. The sbtask binary is treated as a bundled native dependency rather than a separately built iOS project. The `src/` tree holds the Svelte web app (the same code that runs in iOS WebView). The `ios/` tree is the Capacitor-generated Xcode project plus a custom Capacitor plugin (`sbtask-ios`) that handles spawning the embedded binary. No separate `api/` tree — the "API" is the `sbtask serve` process spawned at runtime.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No constitution violations to track (constitution is a placeholder template).

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_    | _n/a_      | _n/a_                                |
