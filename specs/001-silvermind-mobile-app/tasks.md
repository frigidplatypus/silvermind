# Tasks: Silvermind Mobile App

**Input**: Design documents from `/specs/001-silvermind-mobile-app/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested in the feature specification. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web UI**: `src/` at repository root (Svelte 5 runes)
- **iOS native**: `ios/App/` (Capacitor Xcode project, Swift)
- **iOS plugin**: `ios/sbtask-ios/` (custom Capacitor plugin)
- **Scripts**: `scripts/` (shell, TypeScript stubs)
- See `specs/001-silvermind-mobile-app/plan.md` for full project structure

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — create the repo skeleton, install dependencies, configure tooling.

- [x] T001 Initialize npm project with package.json, install Svelte 5, Vite, TypeScript 5, and Capacitor 6 dependencies (package.json, tsconfig.json, vite.config.ts, svelte.config.js)
- [x] T002 [P] Add Capacitor iOS platform and configure capacitor.config.ts with appId, server scheme, and plugin registration
- [x] T003 [P] Install Capacitor plugins: @capacitor/haptics, @capacitor/status-bar, @capacitor/splash-screen in package.json
- [x] T004 [P] Install @capacitor-community/siri-shortcuts (or equivalent Siri Intent plugin) in package.json
- [x] T005 [P] Configure ESLint, Prettier, and svelte-check for TypeScript + Svelte 5 in eslint.config.js, .prettierrc
- [x] T006 [P] Create scripts/fetch-sbtask.sh — shell script to clone/checkout latest release tag from git@git.fluffy-rooster.ts.net:FRGD/sbtask.git and cross-compile for iOS arm64 with CGO_ENABLED=0
- [x] T007 [P] Create scripts/install-binary.sh — copies the compiled sbtask binary into ios/App/sbtask
- [x] T008 [P] Add npm scripts: dev (vite), build (vite build), cap:sync (cap sync ios), cap:open (cap open ios), sbtask:fetch (scripts/fetch-sbtask.sh) in package.json

**Checkpoint**: `pnpm install && pnpm build` succeeds. Capacitor iOS platform is configured.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented. This includes types, API client, native plugin, stores, layout shell, and native wrappers.

**CRITICAL**: No user story work can begin until this phase is complete.

### TypeScript Shared Types

- [x] T009 [P] Create Task type interface matching data-model.md fields in src/lib/types/task.ts
- [x] T010 [P] Create Space type interface matching data-model.md fields in src/lib/types/space.ts
- [x] T011 [P] Create sort mode type (SortMode = 'priority-then-date' | 'created-desc' | 'due-asc' | 'alpha-asc') in src/lib/types/sort.ts
- [x] T012 [P] Create ServiceHealth type interface (state, lastOkAt, restartCount, lastError) in src/lib/types/service.ts

### API Client Layer

- [x] T013 Create fetch wrapper (base URL, error handling, JSON parsing) in src/lib/api/client.ts
- [x] T014 [P] Implement GET /tasks and GET /tasks/{id} API calls in src/lib/api/tasks.ts
- [x] T015 [P] Implement GET /inbox API call in src/lib/api/inbox.ts
- [x] T016 [P] Implement GET /today API call in src/lib/api/today.ts
- [x] T017 [P] Implement POST /done and POST /undo API calls in src/lib/api/done.ts and src/lib/api/undo.ts
- [x] T018 [P] Implement POST /tasks (create), PATCH /tasks/{id} (update), DELETE /tasks/{id} in src/lib/api/tasks.ts
- [x] T019 [P] Implement GET /spaces and GET /health API calls in src/lib/api/spaces.ts

### sbtask-ios Capacitor Plugin (Swift)

- [x] T020 Create custom Capacitor plugin package in ios/sbtask-ios/ with Package.swift, SbtaskPlugin.swift, and SbtaskPlugin.m (Objective-C bridge if needed)
- [x] T021 Implement SbtaskProcess.swift — copies sbtask binary from bundle to writable dir, chmod +x, spawns `sbtask serve` via Process/posix_spawn, watches process exit for restart logic
- [x] T022 Implement SbtaskPlugin.swift — exposes `start()`, `stop()`, `isRunning()`, and emits `serviceStateChanged` event to JS layer with ServiceHealth payload
- [x] T023 Register sbtask-ios plugin in capacitor.config.ts and ios/App/AppDelegate.swift (start plugin on app launch)

### State Management (Svelte 5 Runes)

- [x] T024 Create tasks store runes (byId, ids, sort, isLoading, error) with loadInbox, loadToday, refresh, markDone, undoDone, create, update, remove methods in src/lib/stores/tasks.svelte.ts
- [x] T025 [P] Create space store runes (spaces, active, activeId, isLoading) with load and setActive (persisting to Capacitor Preferences) in src/lib/stores/space.svelte.ts
- [x] T026 [P] Create service health store runes (state, lastOkAt, restartCount, lastError) listening to sbtask-ios plugin events in src/lib/stores/service.svelte.ts
- [x] T027 [P] Create sort selection store runes (mode, setMode) in src/lib/stores/sort.svelte.ts

### Native Wrappers

- [x] T028 [P] Create haptics wrapper — impact (light/medium/heavy) and notification (success/error/warning) helpers using @capacitor/haptics in src/lib/native/haptics.ts
- [x] T029 [P] Create status bar wrapper — setStyle, setBackgroundColor, show/hide helpers using @capacitor/status-bar in src/lib/native/status-bar.ts
- [x] T030 [P] Create splash screen wrapper — show/hide helpers using @capacitor/splash-screen in src/lib/native/splash.ts

### App Shell & Layout

- [x] T031 Create root app.html and app.css with base typography, CSS custom properties for light/dark themes, and responsive layout in src/app.html and src/app.css
- [x] T032 Create main.ts Svelte mount entry point — initializes Capacitor, starts service, mounts Svelte app in src/main.ts
- [x] T033 Create root layout with tab bar navigation (Inbox, Today tabs), splash screen show/hide, status bar styling, and service health banner slot in src/routes/+layout.svelte

**Checkpoint**: Foundation ready — the app skeleton compiles, the sbtask-ios plugin is registered, stores and API client are wired. User story implementation can begin.

---

## Phase 3: User Story 1 - Browse Active Tasks & Mark Done (Priority: P1)

**Goal**: User launches the app and sees active tasks in an inbox list with smooth scrolling. They can pull-to-refresh and swipe left to mark a task as done with haptic feedback. This is the core task management loop.

**Independent Test**: Launch the app with tasks in sbtask. Verify the inbox displays all active tasks, pull-to-refresh reloads, and swiping a task marks it done with haptic feedback and the task animates out.

### Implementation for User Story 1

- [x] T034 [P] [US1] Create TaskRow.svelte — displays a single task (title, priority indicator, due date badge) with semantic HTML and VoiceOver labels in src/lib/components/TaskRow.svelte
- [x] T035 [P] [US1] Create SwipeRow.svelte — wraps children with swipe-left gesture using pointer events, reveals a "Done" action, calls onMarkDone on threshold-cross, respects reduced motion in src/lib/components/SwipeRow.svelte
- [x] T036 [US1] Create TaskList.svelte — renders keyed {#each} of tasks using TaskRow wrapped in SwipeRow, supports pull-to-refresh via on:pointer events or native scroll detection, shows empty state when no tasks in src/lib/components/TaskList.svelte
- [x] T037 [US1] Create Inbox view — loads inbox on mount via tasks store, displays TaskList, wires mark-done to POST /done with optimistic update and haptic feedback in src/routes/inbox/+page.svelte
- [x] T038 [US1] Implement undo completed task — when a task is swiped done, show a brief "Undo" toast that calls POST /undo to restore the task in the list
- [x] T039 [US1] Wire haptic feedback on task completion (light impact when swipe threshold crossed, success notification when done confirms) using native/haptics.ts
- [x] T040 [US1] Ensure TaskList scrolling maintains 60fps with 100+ tasks — verify Svelte keyed each block, avoid expensive reactive statements inside the loop

**Checkpoint**: User Story 1 complete — inbox view, pull-to-refresh, swipe-to-done with haptics, undo. Fully testable independently.

---

## Phase 4: User Story 2 - Rapid Task Capture (Priority: P2)

**Goal**: A persistent bottom input bar allows one-tap task creation from any main view. Typing a title and submitting creates the task instantly.

**Independent Test**: From inbox or today view, tap the input bar, type a title, submit. Verify the task appears in the list and is persisted via the API.

### Implementation for User Story 2

- [x] T041 [P] [US2] Create QuickCapture.svelte — persistent bottom bar with text input, submit button, and cancel behavior. Prevents empty submission. Calls tasks store create method with haptic confirmation in src/lib/components/QuickCapture.svelte
- [x] T042 [US2] Integrate QuickCapture into root layout — rendered above the tab bar, always visible, keyboard-aware (adjusts for safe area) in src/routes/+layout.svelte

**Checkpoint**: User Story 2 complete — quick capture works from every main view. Independently testable.

---

## Phase 5: User Story 3 - Today View with Time-Based Organization (Priority: P2)

**Goal**: The Today view groups tasks into three sections: Overdue, Due Today, and Scheduled Today. This gives users a time-aware task picture.

**Independent Test**: Create tasks with varying dates (overdue, today due, today scheduled, future). Navigate to Today view and verify tasks appear in the correct sections.

### Implementation for User Story 3

- [x] T043 [P] [US3] Create TodayView.svelte — renders three sections (Overdue, Due Today, Scheduled Today) each with a list of TaskRow components, section headings with VoiceOver landmarks in src/lib/components/TodayView.svelte
- [x] T044 [US3] Create Today view page — calls loadToday from tasks store, renders TodayView, supports pull-to-refresh, shows empty state per section in src/routes/today/+page.svelte
- [x] T045 [US3] Integrate swipe-to-done within TodayView — reuse SwipeRow + TaskRow from US1, ensure haptic feedback works the same as in inbox

**Checkpoint**: User Story 3 complete — Today view with all three sections, swipe-to-done within today. Independently testable.

---

## Phase 6: User Story 4 - Task Detail & Attribute Editing (Priority: P3)

**Goal**: Tapping a task opens a detail view showing all attributes. Users can edit description, due date, priority, schedule, and delete the task.

**Independent Test**: Tap a task from inbox or today view. Edit attributes (e.g., due date), save, return. Verify changes persist via the API.

### Implementation for User Story 4

- [x] T046 [P] [US4] Create TaskDetail.svelte — editable form for all task attributes (title, description, priority picker, due date picker, scheduled date picker, space indicator). Shows delete button with confirmation dialog and haptic feedback on confirm. Include VoiceOver labels on all form fields in src/lib/components/TaskDetail.svelte
- [x] T047 [US4] Create Detail view page — loads task by id from route param or store, renders TaskDetail, handles save (PATCH) and delete (DELETE) via tasks store, discards unsaved changes on back navigation in src/routes/task/[id]/+page.svelte
- [x] T048 [US4] Add navigation from TaskRow tap → TaskDetail view (navigate to /task/{id}) in src/lib/components/TaskRow.svelte

**Checkpoint**: User Story 4 complete — task detail view with editing, deletion, back-navigation discard.

---

## Phase 7: User Story 5 - Space Switching (Priority: P3)

**Goal**: A space switcher button lists all configured spaces and allows toggling between them. All views reflect the active space, and the selection persists across app restarts.

**Independent Test**: Configure multiple spaces in sbtask. Use the spacer switcher to change spaces. Verify inbox, today, and quick capture all reflect the active space. Relaunch and verify persistence.

### Implementation for User Story 5

- [x] T049 [P] [US5] Create SpaceSwitcher.svelte — button that opens a popover/menu listing all spaces (from space store), shows checkmark on active space, dispatches setActive on selection in src/lib/components/SpaceSwitcher.svelte
- [x] T050 [US5] Integrate SpaceSwitcher into root layout header — rendered in the navigation bar, accessible label "Select workspace" in src/routes/+layout.svelte
- [x] T051 [US5] Wire space store to tasks store — when active space changes, auto-refresh inbox/today data, filter quick capture to active space in src/lib/stores/space.svelte.ts and src/lib/stores/tasks.svelte.ts
- [x] T052 [US5] Persist active space via Capacitor Preferences — write on setActive, restore on app launch, fall back to default space if persisted id no longer exists in src/lib/stores/space.svelte.ts

**Checkpoint**: User Story 5 complete — space switching with persistence.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories — accessibility, error handling, Siri Shortcuts, empty states, performance tuning, and final validation.

### Accessibility (FR-016)

- [x] T053 [P] Add VoiceOver labels and ARIA roles to all interactive elements (TaskRow, QuickCapture, SpaceSwitcher, TaskDetail, SwipeRow, TodayView headings) — audit each component for missing labels
- [x] T054 [P] Implement Dynamic Type support — all text sizes use rem units, headings scale with system font size, test at largest/smallest accessibility sizes
- [x] T055 [P] Implement reduced motion detection via (prefers-reduced-motion) CSS media query — disable swipe animations, transition effects, and pull-to-refresh animation when enabled in src/lib/accessibility/motion.ts
- [x] T056 [P] Verify color contrast (WCAG AA 4.5:1) across all themes — adjust CSS custom properties in src/app.css where needed

### Error Handling & Edge Cases (FR-018, FR-019)

- [x] T057 [P] Create ServiceErrorBanner.svelte — non-blocking banner displayed when the task service is unhealthy, with auto-dismiss on recovery in src/lib/components/ServiceErrorBanner.svelte
- [x] T058 Implement full-screen error state for startup failure — displayed when the task service cannot start after max retries, with a retry button and clear messaging in src/routes/+layout.svelte
- [x] T059 Implement optimistic update rollback — when an API call fails after optimistic state change, restore the previous state and show a transient error indicator. The optimistic pattern also handles rapid successive API calls (debounce via state batching; local state updates immediately, API calls are sequential per task ID) in src/lib/stores/tasks.svelte.ts

### Siri Shortcuts (FR-017)

- [x] T060 Create siri.ts wrapper — register "Add Task" intent (accepts title string, creates task in active space) and "Open Inbox" / "Open Today" intents (opens app to corresponding view) using the Siri Shortcuts Capacitor plugin in src/lib/native/siri.ts
- [x] T061 Wire Siri Shortcuts into app lifecycle — donate intents on first run, handle incoming intent via Capacitor app plugin in src/main.ts

### Empty States & UX Polish

- [x] T062 [P] Add empty state illustrations/messages for inbox (all tasks complete) and today view (no tasks matching criteria) in src/lib/components/TaskList.svelte and src/lib/components/TodayView.svelte
- [x] T063 [P] Implement sort selection UI — menu/button allowing user to switch between priority-then-date, creation date, due date, and alphabetical sorts in src/lib/components/TaskList.svelte

### Performance & Final Validation

- [x] T064 Measure and validate all time-based success criteria (SC-001 launch <3s, SC-002 swipe <1s, SC-003 refresh <1s, SC-004 capture <5s, SC-008 space switch <1s, SC-009 recovery <5s) — instrument with performance.now() marks and verify against targets on device
- [x] T065 Profile scrolling performance (60fps target, 100+ tasks) — optimize Svelte reactive statements, add requestIdleCallback for non-critical work
- [x] T066 Run quickstart.md validation scenarios — verify all 10 scenarios pass on device/simulator
- [x] T067 Code cleanup — remove console.logs, refactor duplicated logic, ensure consistent error handling patterns across all views

**Checkpoint**: App complete — all user stories, accessibility, error handling, Siri Shortcuts, and performance targets met.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - US1 (Phase 3) must complete before US3 (Phase 5) and US4 (Phase 6) — Today and Detail reuse TaskRow + SwipeRow
  - US2 (Phase 4) depends on Foundational only, can run in parallel with US1
  - US3 (Phase 5) depends on US1 (reuses TaskRow, SwipeRow)
  - US4 (Phase 6) depends on US1 (reuses TaskRow, needs inbox/today to navigate from)
  - US5 (Phase 7) depends on Foundational only, can run in parallel with US1-US4
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — No dependencies on other stories
- **User Story 2 (P2)**: Can start after Phase 2 (parallel with US1) — Independent
- **User Story 3 (P2)**: Depends on US1 (TaskRow, SwipeRow components)
- **User Story 4 (P3)**: Depends on US1 (TaskRow for tap navigation, Tasks store for data)
- **User Story 5 (P3)**: Can start after Phase 2 (parallel with US1) — Independent

### Within Each User Story

- Components before views
- View pages before integration tasks
- Core implementation before polish/haptics
- Story complete before moving to next priority

### Parallel Opportunities

- **Phase 1**: T002-T008 all [P], can run in parallel
- **Phase 2**: All T009-T019 (types + API) can run in parallel. T020-T023 (plugin) can run in parallel. T024-T027 (stores) can run in parallel with each other but depend on types. T028-T033 (wrappers + shell) can run in parallel.
- **Phase 3-7**: US1 + US2 can start in parallel. US5 can start with them. US3 waits for US1 TaskRow. US4 waits for US1 store.
- **Phase 8**: T053-T056 (accessibility), T062-T063 (empty states + sort) all [P], can run in parallel.

---

## Parallel Example: User Story 1

```bash
# Launch component tasks for US1 in parallel:
Task: "Create TaskRow.svelte in src/lib/components/TaskRow.svelte"
Task: "Create SwipeRow.svelte in src/lib/components/SwipeRow.svelte"

# Then sequential (both depend on TaskRow + SwipeRow):
Task: "Create TaskList.svelte in src/lib/components/TaskList.svelte"
Task: "Create Inbox view in src/routes/inbox/+page.svelte"
```

## Parallel Example: Foundational Phase

```bash
# Launch all independent foundational tasks together:
# - All TypeScript types (T009-T012)
# - All API modules (T013-T019)
# - sbtask-ios plugin (T020-T023) — independent of TS
# - Native wrappers (T028-T030) — independent of everything
# Then stores (T024-T027) depend on types
# Then app shell (T031-T033) depends on stores + wrappers
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (~T001-T008)
2. Complete Phase 2: Foundational (~T009-T033)
3. Complete Phase 3: User Story 1 (~T034-T040)
4. **STOP and VALIDATE**: Test inbox view with swipe-to-done + haptics + pull-to-refresh on device
5. This is a usable, shippable MVP — users can view and complete tasks

### Incremental Delivery

1. Setup + Foundational → App skeleton (no user features yet)
2. Add US1 (Inbox + mark done) → Test independently → **MVP**: users can view & complete tasks
3. Add US2 (Quick capture) → Test independently → Users can add new tasks
4. Add US3 (Today view) → Test independently → Users have time-aware view
5. Add US4 (Task detail) → Test independently → Users can edit task attributes
6. Add US5 (Space switcher) → Test independently → Users can switch workspaces
7. Add Polish (accessibility, errors, Siri, empty states) → Ship-ready

### Parallel Team Strategy

With multiple developers after Foundational completes:

- Developer A: User Story 1 (Inbox + mark done) — T034-T040
- Developer B: User Story 2 + 5 (Quick capture + Space switcher) — T041-T042, T049-T052
- Developer C: Starts after A finishes TaskRow — User Story 3 (Today view) — T043-T045
- Developer D: Starts after A finishes Tasks store — User Story 4 (Task detail) — T046-T048
- Polish split across all after stories complete

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Tests are omitted (not requested in spec)
- All Svelte files use runes mode (`$state`, `$derived`, `$effect` — no legacy stores)
- Paths match plan.md project structure
