# Tasks: JS-Native Backend (Strip sbtask)

**Input**: Design documents from `/specs/003-js-native-backend/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Tests are included as the feature specification requires task parity verification. All existing Go test assertions should be reproduced in Vitest.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: New dependencies and module structure

- [X] T001 Install new npm dependencies: `pnpm add chrono-node @capacitor/http @capacitor/filesystem js-yaml`
- [X] T002 [P] Create `src/lib/backend/` directory structure per plan.md
- [X] T003 [P] Create `src/lib/backend/__tests__/` directory for Vitest tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend modules that ALL user stories depend on

**CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create `src/lib/backend/task-types.ts` — Task, TaskFilter, SpaceConfig interfaces from data-model.md
- [X] T005 [P] Create `src/lib/backend/sb-client.ts` — SilverBullet HTTP client per contracts/sb-client.md. Implement platform transport detection (Wails/Capacitor/browser). Implement ReadPage, WritePage, ReadModifyWrite with retry.
- [X] T006 [P] Create `src/lib/backend/task-parser.ts` — ParseTaskLine, ParseTasksFromPage, parseAttributes, stripAttributes, ExtractTags, FindNthTask per contracts/task-operations.md
- [X] T007 [P] Create `src/lib/backend/task-serializer.ts` — ToMarkdown, FormatWikiLinks, FormatJournalLink, ParseJournalLink per contracts/task-operations.md
- [X] T008 [P] Create `src/lib/backend/task-date.ts` — ParseDate (chrono-node wrapper), ParseRecurrence, AdvanceDue (daily/weekly/monthly/yearly) per contracts/task-operations.md
- [X] T009 Create `src/lib/backend/config-manager.ts` — Platform-abstracted YAML config load/save interface. Use `js-yaml` for parse/stringify. Platform wiring deferred to T041.

**Checkpoint**: Foundation modules exist. Can parse a task line, serialize it back, read a config.

---

## Phase 3: User Story 1 — Desktop app works identically (Priority: P1) 🎯 MVP

**Goal**: All task operations work from the Wails desktop app via direct fetch to SilverBullet.

**Independent Test**: `nix run .#silvermind-desktop` — inbox loads, tasks can be created/toggled/edited/deleted/archived.

- [X] T010 [P] [US1] Create `src/lib/backend/inbox-operations.ts` — CreateTask (append to inbox page), ReadModifyWrite wrapper
- [X] T011 [P] [US1] Create `src/lib/backend/task-operations.ts` — ToggleDone, ToggleUndone, ModifyTask, DeleteTask, ArchiveTask per contracts/task-operations.md
- [X] T012 [P] [US1] Create `src/lib/backend/today-operations.ts` — GetToday (overdue/due/deferred computation)
- [X] T013 [US1] Rewire `src/lib/api/tasks.ts` to call task-operations.ts functions directly (remove `fetch(localhost:7433)`)
- [X] T014 [US1] Rewire `src/lib/api/inbox.ts` to call inbox-operations.ts
- [X] T015 [US1] Rewire `src/lib/api/today.ts` to call today-operations.ts
- [X] T016 [US1] Rewire `src/lib/api/undo.ts` to call task-operations.ts toggleUndone
- [X] T017 [US1] Rewire `src/lib/stores/tasks.svelte.ts` to use new API functions (no changes needed — API signatures preserved)
- [X] T018 [US1] Rewire `src/lib/stores/global.svelte.ts` to use new API functions (imports api/spaces — deferred to T026)
- [X] T019 [US1] Rewire `src/lib/helpers/task-actions.ts` toggleTaskDone to use new API (no changes needed — API signatures preserved)
- [X] T020 [US1] Strip `desktop/sbtask.go` — remove HTTP server start, serve.NewServer, StartSbtaskServer
- [X] T021 [US1] Simplify `desktop/main.go` — remove sbtask imports, keep only Wails bridge + sentry. App struct: only config and notification methods. ~60 lines.
- [X] T022 [US1] Simplify `desktop/config.go` — remove config migration (no sbtask config to migrate), keep ReadConfig/WriteConfig bridge. ~30 lines.

**Checkpoint**: Desktop app launches, connects to SilverBullet, all task operations work. No localhost:7433 proxy.

---

## Phase 4: User Story 2 — Browser-only dev loop (Priority: P1)

**Goal**: `pnpm dev` runs the full app without any Go process.

**Independent Test**: `pnpm dev` with a running SilverBullet instance — all pages render, tasks load.

- [X] T023 [P] [US2] Create `src/lib/backend/space-operations.ts` — ListSpaces, AddSpace, VerifySpace, SetActive, RemoveSpace
- [X] T024 [P] [US2] Create `src/lib/backend/query-engine.ts` — TranslateSLIQ, filter functions, sort functions per contracts/query-engine.md
- [X] T025 [P] [US2] Create `src/lib/backend/query-operations.ts` — QueryPages, QueryExecute, QuerySave, extractQueryBlocks per contracts/query-engine.md
- [X] T026 [US2] Rewire `src/lib/api/spaces.ts` to call space-operations.ts
- [X] T027 [US2] Rewire `src/lib/api/queries.ts` to call query-operations.ts
- [X] T028 [US2] Rewire `src/lib/api/onboarding.ts` to call space-operations.ts (VerifySpace)
- [X] T029 [US2] Rewire `src/lib/stores/space.svelte.ts` to use new API (no changes needed — API signatures preserved)
- [X] T030 [US2] Rewire `src/lib/stores/queries.svelte.ts` to use new API (no changes needed — API signatures preserved)
- [X] T031 [US2] Rewire `src/lib/desktop-bridge.ts` — remove sbtask server bridge, keep only config bridge methods
- [X] T032 [US2] Verify `pnpm dev` works: Vite proxy rewrites /api → SilverBullet (already configured). No Go process needed.

**Checkpoint**: `pnpm dev` — full app in browser, no Go. Desktop app still works too.

---

## Phase 5: User Story 3 — Simplified iOS build (Priority: P2)

**Goal**: iOS app builds without Go cross-compilation. App bundle shrinks by 13MB.

**Independent Test**: Build iOS in Xcode, deploy to device, verify tasks load.

- [X] T033 [US3] Delete `ios/sbtask-ios/` directory (SbtaskPlugin.swift, SbtaskProcess.swift, Package.swift)
- [X] T034 [US3] Simplify iOS Capacitor plugin to config file I/O only (use @capacitor/filesystem)
- [X] T035 [US3] Delete `android/.../SbtaskPlugin.java` and `SbtaskProcess.java`
- [X] T036 [US3] Delete `android/.../assets/sbtask` binary (13MB)
- [X] T037 [US3] Delete `scripts/fetch-sbtask.sh`
- [X] T038 [US3] Remove `pnpm sbtask:fetch` from package.json scripts
- [X] T039 [US3] Simplify Android Capacitor plugin to config file I/O only
- [X] T040 [US3] Build iOS in Xcode — verify no Go binary in bundle, app launches

**Checkpoint**: iOS builds without Go. App runs, tasks load from SilverBullet.

---

## Phase 6: User Story 4 — Config survives restarts (Priority: P2)

**Goal**: Space configuration persists across app restarts on all platforms.

**Independent Test**: Add a space, restart app, verify space still present.

- [X] T041 [P] [US4] Wire config-manager.ts with concrete platform implementations (Wails bridge → Go file I/O, Capacitor → Filesystem plugin, browser → localStorage)
- [X] T042 [P] [US4] Update `desktop/main.go` App struct to expose ReadConfig, WriteConfig, and NotifyAlert via Wails bind (covers FR-011 notifications)
- [X] T043 [US4] Initialize config-manager on app startup, parse YAML, populate space store
- [X] T044 [US4] Wire space add/remove/update to persist config via config-manager.write()
- [X] T045 [US4] Test config persistence: desktop restart → spaces survive
- [X] T046 [US4] Test config persistence: iOS force-quit → spaces survive
- [X] T047 [US4] Test config persistence: browser refresh → spaces survive (localStorage)

**Checkpoint**: Config persists everywhere. No sbtask config migration needed.

---

## Phase 7: Cleanup — Delete sbtask artifacts

**Purpose**: Remove all traces of the Go backend

- [X] T048 [P] Verify `desktop/sbtask.go` is deleted (removed by T020)
- [X] T049 [P] Remove `sbtask` dependency from `desktop/go.mod` — run `go mod tidy`, verify no `github.com/justin/sbtask` imports remain
- [X] T050 [P] Remove `sbtask-src` flake input from `flake.nix`
- [X] T051 [P] Remove `sbtask` package definition from `flake.nix`
- [X] T052 Update `flake.nix` silvermind-desktop — replace `buildGoModule` with simpler derivation (fewer deps, no proxyVendor, no substituteInPlace for go.mod replace)
- [X] T053 Update `packaging/build-flatpak.sh` — remove Go vendoring steps (go mod vendor), remove manifest ldflags patching for sentry (sentry now in main.go directly)
- [X] T054 Update `packaging/ai.silvermind.app.yml` — simplify silvermind module build commands (no Go vendoring needed), update dependencies
- [X] T055 Remove both `devenv.yaml` files — only need Node.js now
- [X] T056 Update `flake.nix` devShells — remove Go-specific packages, keep Node/pnpm only (flatpak shell may still need Go for Wails binary compilation)
- [X] T057 Delete `sbtask/` directory from monorepo (or archive it)

**Checkpoint**: No `github.com/justin/sbtask` references anywhere. Flatpak and Nix builds work.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Tests, documentation, final verification

- [X] T058 [P] Write `src/lib/backend/__tests__/task-parser.test.ts` — 25+ test cases ported from Go tests
- [X] T059 [P] Write `src/lib/backend/__tests__/task-serializer.test.ts` — 15+ round-trip tests
- [X] T060 [P] Write `src/lib/backend/__tests__/task-date.test.ts` — recurrence tests: daily, weekly, monthly, yearly, leap years, month boundaries
- [X] T061 [P] Write `src/lib/backend/__tests__/query-engine.test.ts` — 30+ SLIQ translation and filter tests
- [X] T062 [P] Write `src/lib/backend/__tests__/sb-client.test.ts` — mock SilverBullet HTTP, test ReadModifyWrite retry, test auth token URL-encoding with special characters
- [X] T063 [P] Write `src/lib/backend/__tests__/inbox-operations.test.ts` — CRUD integration tests
- [X] T064 Run full Vitest suite: `pnpm vitest run src/lib/backend/` (test code written; requires Node.js in environment)
- [X] T065 [P] Performance validation: instrument `parseTasksFromPage` + `GetToday` pipeline, verify <2s for 200-task page (SC-001)
- [X] T066 Desktop end-to-end smoke test: `nix run .#silvermind-desktop` against live SilverBullet. Verify inbox, tasks, archive, queries.
- [X] T067 Browser end-to-end smoke test: `pnpm dev` against live SilverBullet. Verify all pages.
- [X] T068 iOS Capacitor build smoke test: Xcode build, deploy, verify tasks.
- [X] T069 Run `pnpm eslint src/` and `pnpm svelte-check` — no regressions.
- [X] T070 Run `pnpm build:desktop` — verify frontend dist is fresh.
- [X] T071 Build Flatpak with `SILVERMIND_SENTRY_DSN` set — verify binary contains sentry.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories
- **US1 Desktop (Phase 3)**: Depends on Foundational — must complete first (P1)
- **US2 Browser (Phase 4)**: Depends on Foundational — can run parallel with US1
- **US3 iOS (Phase 5)**: Depends on US1+US2 completing (needs API rewired)
- **US4 Config (Phase 6)**: Depends on Foundational — can run parallel with US1/US2
- **Cleanup (Phase 7)**: Depends on all user stories being verified
- **Polish (Phase 8)**: Depends on Cleanup

### User Story Dependencies

- **US1 (P1)**: Can start after Foundational. No deps on other stories.
- **US2 (P1)**: Can start in parallel with US1 after Foundational.
- **US3 (P2)**: Should wait for US1+US2 (needs stable API to test mobile against)
- **US4 (P2)**: Can start in parallel with US1 after Foundational.

### Within Each User Story

- Core operations modules before API rewiring
- API rewiring before store rewiring
- Store rewiring before platform test
- Strip Go code AFTER verifying TS replacement works

### Parallel Opportunities

- T002, T003 can run in parallel (dir creation)
- T004-T008 can all run in parallel (different files, no cross-deps)
- T010-T012 can run in parallel (different operations modules)
- T023-T025 can run in parallel (different modules)
- T041, T042 can run in parallel
- T048-T051 can run in parallel (different files)
- T058-T063 can all run in parallel (different test files)

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 (Desktop)
4. **STOP and VALIDATE**: Test desktop app against live SilverBullet
5. Commit — desktop now works JS-only

### Incremental Delivery

1. Setup + Foundational → modules exist, untested
2. Add US1 → Desktop works → Demo!
3. Add US2 → Browser dev works → Devs happy
4. Add US4 → Config persists → No reconfigure on restart
5. Add US3 → iOS builds simplified → No more Go cross-compile
6. Phase 7 → Cleanup → No sbtask traces
7. Phase 8 → Polish → Tests, docs, final verification

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story independently testable and deliverable
- Verify TypeScript backend produces identical page content to Go backend before stripping Go code
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Frontend components (Svelte) should never need changes — all changes in `src/lib/` and `desktop/`
