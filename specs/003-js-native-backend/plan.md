# Implementation Plan: JS-Native Backend (Strip sbtask)

**Branch**: `003-js-native-backend` | **Date**: 2026-06-30 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-js-native-backend/spec.md`

## Summary

Replace ~5000 lines of Go (sbtask) with ~1700 lines of TypeScript running in the WebView. Eliminate Go from all builds. Desktop gets a ~90-line Wails Go bridge for config file I/O only. TypeScript backend modules handle task parsing, serialization, date math, SLIQ queries, and SilverBullet HTTP communication directly from the WebView using `fetch()`. Mobile CORS is bypassed via `@capacitor/http` plugin. The existing Svelte frontend components, routes, and stores remain unchanged.

## Technical Context

**Language/Version**: TypeScript 5.x / Svelte 5 runes (webview backend), Go 1.26 (Wails bridge only, ~90 lines)

**Primary Dependencies**:
- `chrono-node` — natural language date parsing (replaces Go's `when` library)
- `@capacitor/http` — native HTTP on mobile (CORS bypass)
- `@capacitor/filesystem` — file I/O for mobile config
- `js-yaml` — YAML config parse/stringify
- Svelte 5 + Vite (unchanged frontend build)
- Wails v2 (unchanged desktop shell)
- Feather Icons (unchanged)

**Storage**:
- Desktop: `~/.config/silvermind/config.yaml` via Wails Go bridge
- iOS/Android: Capacitor Filesystem plugin → app sandbox
- Web (dev): `localStorage`
- SilverBullet: remote page content (unchanged)

**Testing**: Vitest for TypeScript backend modules. Mock SilverBullet HTTP responses with MSW or inline fetch mocks.

**Target Platform**: Linux desktop (Wails/Flatpak/Nix), iOS (Capacitor), Android (Capacitor), Web browser (Vite dev)

**Project Type**: Desktop app + mobile app + web SPA (monorepo, shared Svelte frontend)

**Performance Goals**: Task inbox load <2s for 200 tasks. Config read <100ms.

**Constraints**: No Go HTTP server. No subprocess management. Frontend API surface unchanged. Existing config file format preserved.

**Scale/Scope**: ~1700 new TS lines across 12 modules. ~5000 Go lines deleted. 2 mobile plugins simplified (~470 native lines reduced to ~100).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution template is unpopulated — no gates to enforce. Skipping.

## Project Structure

### Documentation (this feature)

```text
specs/003-js-native-backend/
├── plan.md              # This file
├── research.md          # Phase 0: tech choices, dependency analysis
├── data-model.md        # Phase 1: TypeScript interfaces, state transitions
├── quickstart.md        # Phase 1: how to test each platform
├── contracts/           # Phase 1: module interfaces
│   ├── sb-client.md     #   SilverBullet HTTP client
│   ├── task-operations.md # Task CRUD + parser/serializer
│   └── query-engine.md  #   SLIQ parser + filters
└── tasks.md             # Phase 2 (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/lib/backend/                  # NEW: TypeScript backend modules
├── sb-client.ts                  # SilverBullet HTTP client
├── task-types.ts                 # Task, TaskFilter interfaces
├── task-parser.ts                # ParseTaskLine, ParseTasksFromPage
├── task-serializer.ts            # ToMarkdown, FormatWikiLinks
├── task-date.ts                  # ParseDate (chrono-node), AdvanceDue
├── task-operations.ts            # ToggleDone, ModifyTask, DeleteTask, ArchiveTask
├── inbox-operations.ts           # CreateTask, ReadModifyWrite for inbox
├── today-operations.ts           # GetToday (overdue/due/deferred)
├── space-operations.ts           # ListSpaces, AddSpace, VerifySpace
├── query-engine.ts               # SLIQ parser, filter/sort pipeline
├── query-operations.ts           # QueryPages, QueryExecute, QuerySave
├── config-manager.ts             # Platform-aware YAML config
└── __tests__/                    # Vitest tests for above

desktop/                           # SIMPLIFIED: Go Wails bridge only
├── main.go                       # ~60 lines: Wails entry, config bridge
└── config.go                     # ~30 lines: file I/O

ios/sbtask-ios/                   # DELETED
android/.../SbtaskPlugin.java     # DELETED (replaced by Capacitor Filesystem plugin)
android/.../SbtaskProcess.java    # DELETED
scripts/fetch-sbtask.sh           # DELETED
```

**Structure Decision**: Single Svelte project with `src/lib/backend/` for TypeScript logic. Wails Go bridge shrinks to minimal surface. Native mobile plugins simplify to Capacitor Filesystem plugin (config I/O) only. No more separate sbtask repository.

## Complexity Tracking

No constitution violations to justify.

## Phase 0: Research (Complete)

See [research.md](./research.md) for:
- `chrono-node` selected for date parsing (replaces Go's `when`)
- `@capacitor/http` selected for mobile CORS bypass
- `js-yaml` selected for config parsing
- Atomic writes implemented with fetch + If-Match header + retry loop
- SLIQ parser ported from Go — no external dependency needed
- All SilverBullet API endpoints unchanged

## Phase 1: Design Artifacts (Complete)

- [data-model.md](./data-model.md) — Task, TaskFilter, SpaceConfig, QueryBlock interfaces
- [contracts/sb-client.md](./contracts/sb-client.md) — SbClient interface with transport abstraction
- [contracts/task-operations.md](./contracts/task-operations.md) — Parser, serializer, CRUD contracts
- [contracts/query-engine.md](./contracts/query-engine.md) — SLIQ parser + filter pipeline
- [quickstart.md](./quickstart.md) — How to test on each platform

## Migration Order

> **Plan ↔ Tasks Phase Mapping**: plan Phase 1 = tasks Phase 1-2, plan Phase 2 = tasks Phase 3-4, plan Phase 3 = tasks Phase 5-7, plan Phase 4 = tasks Phase 8. See [tasks.md](./tasks.md) for full breakdown.

### Phase 1 — Core modules (Day 1)
1. Create `src/lib/backend/sb-client.ts` — SilverBullet fetch with platform transport
2. Create `src/lib/backend/task-types.ts` — Task, TaskFilter interfaces
3. Create `src/lib/backend/task-parser.ts` — ParseTaskLine, ParseTasksFromPage, ExtractTags
4. Create `src/lib/backend/task-serializer.ts` — ToMarkdown, FormatWikiLinks, FormatJournalLink
5. Create `src/lib/backend/task-date.ts` — ParseDate (chrono-node), AdvanceDue
6. Create `src/lib/backend/config-manager.ts` — Platform-aware YAML config

### Phase 2 — Operations (Day 2)
7. Create `src/lib/backend/inbox-operations.ts` — CreateTask, ReadModifyWrite for inbox
8. Create `src/lib/backend/task-operations.ts` — ToggleDone, ModifyTask, DeleteTask, ArchiveTask
9. Create `src/lib/backend/today-operations.ts` — GetToday logic
10. Create `src/lib/backend/space-operations.ts` — ListSpaces, AddSpace, VerifySpace
11. Create `src/lib/backend/query-engine.ts` — SLIQ parser, filter/sort pipeline
12. Create `src/lib/backend/query-operations.ts` — QueryPages, QueryExecute, QuerySave

### Phase 3 — Wire + Strip (Day 3)
13. Rewire `src/lib/api/*.ts` to call TS backend functions (no HTTP to localhost)
14. Rewire `src/lib/stores/*.svelte.ts` to use new API
15. Strip `desktop/`: delete `sbtask.go`, simplify `main.go` + `config.go`
16. Delete `ios/sbtask-ios/`
17. Delete Android subprocess plugin files
18. Delete `scripts/fetch-sbtask.sh`
19. Update `packaging/build-flatpak.sh`
20. Update `packaging/ai.silvermind.app.yml`
21. Update `flake.nix`
22. `pnpm add chrono-node @capacitor/http @capacitor/filesystem js-yaml`

### Phase 4 — Test (Day 4)
23. Write Vitest unit tests for all backend modules
24. Desktop smoke test: `nix run` against live SB
25. Browser smoke test: `pnpm dev` against live SB
26. iOS Capacitor build test

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Date regression in recurrence math | Medium | Port Go tests to Vitest verbatim |
| CORS blocking mobile fetch | Medium | `@capacitor/http` plugin — proven solution |
| Wails bridge latency for config read | Low | Config read once at startup, cached in memory |
| SilverBullet API version mismatch | Low | Same `/.fs/` and `/.runtime/` endpoints — unchanged |
| `chrono-node` parses differently than `when` | Low | Test common expressions: "tomorrow", "next monday", "in 3 days" |
| Large pages (>500 tasks) performance | Low | SilverBullet pages typically <100 tasks. Add pagination if needed |
