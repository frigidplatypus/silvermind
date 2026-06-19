# Tasks: Silvermind Desktop Layout

**Input**: Design documents from `/specs/002-desktop-layout/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Not explicitly requested. Test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)

## Path Conventions

- **Go backend**: `desktop/` at repository root
- **Svelte UI**: `src/` (shared with mobile)
- **Desktop components**: `src/lib/components/` (new files)
- **Vite config**: root (new file for desktop build)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization — create the Wails project scaffold, Go module, Vite desktop config.

- [x] T001 Initialize Wails v2 project scaffold in desktop/ with go.mod, main.go, wails.json, and app.go skeleton
- [x] T002 Add `replace github.com/justin/sbtask => /home/justin/development/go/sbtask` directive in desktop/go.mod
- [x] T003 [P] Create vite.config.desktop.ts — Svelte plugin + resolve alias $lib, output to desktop/frontend/dist/, exclude Capacitor plugins from dependency optimization
- [x] T004 [P] Add npm scripts: `build:desktop` (vite --config vite.config.desktop.ts) in package.json
- [x] T005 [P] Add desktop build dependencies to devenv.nix: wails, webkitgtk_6_0, gtk3, pkg-config

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Go backend with sbtask integration, Wails AppService, and desktop layout infrastructure. MUST complete before any user story.

### Go Backend

- [x] T006 Implement desktop/app.go — App struct with sbtask serve lifecycle (start, stop, health polling), graceful shutdown on window close
- [x] T007 [P] Implement desktop/service.go — AppService struct exposing methods: StartSbtask, StopSbtask, GetHealth, ListSpaces, AddSpace, UpdateSpace, RemoveSpace, SetActiveSpace, GetConfigPath (contracts/app-service.md)
- [x] T008 [P] Implement desktop/config.go — config file read/write for ~/.config/sbtask/config.yaml (YAML marshal/unmarshal), default config generation
- [x] T009 Wire desktop/main.go — Wails v3 entry point: create app, register AppService, set window size (1200x800), min size (800x600)
- [x] T010 Validate sbtask library import compiles — `go build ./...` in desktop/ succeeds, sbtask pkg/serve is importable

### Desktop Layout Infrastructure

- [x] T012 [P] Create desktop layout state store in src/lib/stores/desktop.svelte.ts — selectedTaskId, splitRatio, isDesktop (media query detection)
- [x] T013 Create desktop entry point in src/main.ts — detect Wails vs Capacitor runtime, call appropriate mount (Wails service init or svelte mount)
- [x] T014 Update src/routes/+layout.svelte — add $effect that detects window.innerWidth >= 800, sets desktop.isDesktop, conditionally renders DesktopShell vs mobile layout

**Checkpoint**: `cd desktop && go build ./...` succeeds. `pnpm build:desktop` produces dist/. Layout detects desktop width and toggles mode.

---

## Phase 3: User Story 1 — Desktop Shell & Navigation (Priority: P1)

**Goal**: The app opens in a native window with a sidebar showing Inbox, Today, Settings. Clicking any item switches the main content area. The window resizes, minimizes, and closes normally.

**Independent Test**: Launch the Wails binary. Verify native window opens, sidebar shows three items, clicking each switches the view, window can be resized/minimized/closed.

### Implementation for User Story 1

- [x] T015 [P] [US1] Create Sidebar.svelte — fixed 220px left panel with Inbox/Today/Settings nav items, feather icons (inbox, calendar, settings), active item highlight, onClick calls onNavigate in src/lib/components/Sidebar.svelte
- [x] T016 [US1] Create DesktopShell.svelte — composes Sidebar + main content area (children), detects desktop mode, passes activeView and onNavigate to sidebar in src/lib/components/DesktopShell.svelte
- [x] T017 [US1] Update +layout.svelte to render DesktopShell when isDesktop is true, with sidebar nav wired to the existing tab routing (currentTab state) in src/routes/+layout.svelte
- [x] T018 [US1] Style responsive breakpoint at 800px — CSS media query hides mobile tab bar / shows desktop sidebar, sidebar fixed 220px, main area fills 1fr in src/routes/+layout.svelte and src/app.css (depends on T017 — both modify +layout.svelte)
- [x] T019 [US1] Implement window lifecycle — on close, call AppService.StopSbtask() for graceful shutdown (5s drain) in desktop/app.go

**Checkpoint**: Desktop shell launches, sidebar navigates views, window operates normally.

---

## Phase 4: User Story 2 — Split-Pane Task Management (Priority: P1)

**Goal**: Two-column layout: task list on left (2/3), detail on right (1/3). Clicking a task shows its detail inline. Divider is draggable. Below 800px collapses to mobile stack.

**Independent Test**: Open app. Click a task — detail appears on right. Drag divider — panels resize. Resize window below 800px — layout collapses to single column.

### Implementation for User Story 2

- [x] T020 [P] [US2] Create SplitPane.svelte — resizable two-column container: left panel (task list), right panel (detail/editor), draggable divider using pointer events, min 200px per panel, default 66/33 ratio in src/lib/components/SplitPane.svelte
- [x] T021 [US2] Wire split pane into DesktopShell — render InboxPage or TodayPage inside SplitPane's left slot, render TaskDetail or TaskEditor in right slot when a task is selected in src/lib/components/DesktopShell.svelte
- [x] T022 [US2] Wire selectedTaskId — update TaskList.svelte to accept an onTaskSelect prop (called on task click with task id). In DesktopShell, wire onTaskSelect to setSelectedTaskId. Right panel shows TaskDetail for the selected task; editing opens TaskEditor inline in the right panel in src/lib/components/TaskList.svelte and DesktopShell.svelte
- [x] T023 [US2] Wire divider drag state — on pointerdown start tracking, on pointermove update splitRatio, on pointerup release. Style divider as 4px bar with hover cursor in SplitPane.svelte

**Checkpoint**: Split pane works — tasks select and show detail inline, divider drags, collapsed to mobile at <800px.

---

## Phase 5: User Story 3 — Configuration Manager (Priority: P2)

**Goal**: Settings view shows space list with Add/Edit/Remove. Native dialogs for confirmations. Changes persist to sbtask config.yaml and sbtask serve restarts for active space changes.

**Independent Test**: Add a new space via Settings, verify it appears in space switcher. Edit its name. Delete it. Verify config.yaml reflects changes.

### Implementation for User Story 3

- [x] T024 [P] [US3] Implement AddSpace, UpdateSpace, RemoveSpace, SetActiveSpace Go methods in desktop/service.go — read/write config.yaml, validate uniqueness, restart sbtask on active space change
- [x] T025 [P] [US3] Implement native dialog wrappers in Go — confirmDialog for space removal, alertDialog for errors in desktop/dialogs.go
- [x] T026 [US3] Update settings page — replace read-only space list with editable list: Add Space button, Edit/Remove buttons per space, active space radio/dropdown in src/routes/settings/+page.svelte
- [x] T027 [US3] Add add/edit space form — name, URL, default page, inbox page fields. On save, call AppService.AddSpace/UpdateSpace. On remove, confirm via native dialog then call AppService.RemoveSpace in src/routes/settings/+page.svelte
- [x] T028 [US3] Wire active space change — on select, call AppService.SetActiveSpace, which restarts sbtask serve and emits config:spaces-changed event. Frontend listens and reloads spaces + tasks in src/routes/settings/+page.svelte and +layout.svelte

**Checkpoint**: Spaces configurable from UI, changes persist to config file, active space switching works.

---

## Phase 6: User Story 4 — Keyboard Navigation (Priority: P3)

**Goal**: Power-user keyboard shortcuts: Ctrl+N (new task), / (focus search), j/k (navigate list), Space (toggle done), Esc (close detail), 1-3 (switch views).

**Independent Test**: Press each shortcut and verify the expected action occurs within 200ms.

### Implementation for User Story 4

- [x] T029 [US4] Add global keydown listener in +layout.svelte — match shortcuts, filter by focus context (no shortcuts when input/textarea focused, except Ctrl+N and /) in src/routes/+layout.svelte
- [x] T030 [P] [US4] Implement Ctrl+N handler — focus the quick capture input, clear and select any existing text
- [x] T031 [P] [US4] Implement j/k handlers — move selectedTaskId to next/previous task in the current list, clamp to bounds
- [x] T032 [US4] Implement Space handler — when a task is selected, toggle done status via the existing markDone/undo flow
- [x] T033 [P] [US4] Implement Esc handler — clear selectedTaskId to close the detail panel and return focus to the task list
- [x] T034 [P] [US4] Implement 1-3 handlers — switch sidebar view: 1=Inbox, 2=Today, 3=Settings via sidebar navigation

**Checkpoint**: All 7 keyboard shortcuts work, produce expected action within 200ms.

---

## Phase 7: User Story 5 — Quick Capture as Top Bar (Priority: P3)

**Goal**: Quick capture input is a persistent top bar in the main content area on desktop, styled as a search-like input.

**Independent Test**: Verify the input is visible at the top of every main view. Type a task, press Enter — task is created and appears in the list.

### Implementation for User Story 5

- [x] T035 [US5] Style QuickCapture as a top bar in desktop mode — CSS class .desktop-quick-capture with horizontal layout, search-like rounded input, positioned at the top of the main content area in src/lib/components/QuickCapture.svelte and src/routes/+layout.svelte
- [x] T036 [US5] Move QuickCapture rendering from bottom slot to top slot when isDesktop is true — conditionally render in the DesktopShell above the split pane in src/lib/components/DesktopShell.svelte and src/routes/+layout.svelte
- [x] T036 [US5] Wire keyboard shortcut / to focus the quick capture input — unlike other shortcuts, / always fires even when an input is focused (use document.activeElement check), moves focus to quick capture and selects existing text

**Checkpoint**: Quick capture is a top bar on desktop, bottom bar on mobile. Both work identically for task creation.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Build pipeline, graceful degradation, error handling, documentation.

- [x] T038 [P] Verify Capacitor plugins are excluded from desktop build — check desktop/frontend/dist/ does not reference @capacitor/* in src/lib/native/ files remain as graceful no-ops
- [x] T039 [P] Style the desktop split pane divider — 4px wide, hover cursor: col-resize, semi-transparent background matching theme
- [x] T039 [P] Add desktop toast notification for sbtask status changes (starting/running/failed) — subtle toast in the top-right corner of the desktop layout, auto-dismiss after 3 seconds
- [x] T041 Implement sbtask startup failure dialog — on AppService.StartSbtask failure, show native error dialog with the failure reason and "Open Config Manager" button
- [x] T042 [P] Add default config generation — if ~/.config/sbtask/config.yaml is missing, create a default with a single space pointing to localhost:3000
- [x] T043 Verify binary size <20MB — run `cd desktop && go build -ldflags="-s -w" -o silvermind . && stat -c%s silvermind`
- [x] T044 Run quickstart.md validation scenarios — all 6 scenarios pass on the built binary
- [x] T044 Code cleanup — remove debug logs, refactor duplicated layout logic, ensure consistent error handling

**Checkpoint**: Desktop app complete — all user stories, keyboard shortcuts, build pipeline, validation scenarios passed.
