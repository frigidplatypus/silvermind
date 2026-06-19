# Feature Specification: Prowl Desktop Layout

**Feature Branch**: `002-desktop-layout`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Desktop layout for Prowl using Wails (Go + Svelte 5) as the desktop wrapper. The app embeds sbtask as a Go library (imports pkg/serve directly, no separate binary) and starts the HTTP server in-process on launch. The same Svelte 5 codebase serves both desktop and mobile — desktop layout is achieved via CSS media queries, not a code fork."

## Clarifications

### Session 2026-06-19

- Q: Wails v3 Go API approach — how does the Go backend communicate with the Svelte frontend? → A: Service pattern. Go exposes an AppService (sbtask lifecycle, config CRUD, health) and the frontend calls these via `@wailsio/runtime`. Native dialogs use `window.runtime.WindowDialogs()`.
- Q: How does Prowl's Wails project import sbtask as a Go library? → A: Local `replace` directive in go.mod: `replace github.com/justin/sbtask => /home/justin/development/go/sbtask`. Live co-development, no version bumps needed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Desktop Shell & Navigation (Priority: P1)

A user launches Prowl on their Linux desktop. The app opens in a native window with a dark-themed sidebar showing Inbox, Today, and Settings as persistent navigation items. The active view is highlighted, and clicking any item switches the main content area instantly.

**Why this priority**: Without the desktop shell, there is no app. This delivers the basic window, navigation, and layout that all other features depend on.

**Independent Test**: Launch the Wails binary. Verify a native window opens with a sidebar on the left showing Inbox, Today, and Settings. Verify clicking each item switches the main content area. Verify the window can be resized, minimized, and closed normally.

**Acceptance Scenarios**:

1. **Given** the app binary is built, **When** the user runs `prowl-desktop`, **Then** a native window opens with the Svelte UI rendered inside a system WebView within 3 seconds.
2. **Given** the app is open, **When** the user clicks "Today" in the sidebar, **Then** the main content area switches to the Today view and the sidebar highlights "Today".
3. **Given** the app is open, **When** the user resizes the window, **Then** the layout adapts — the sidebar remains fixed width and the main area fills remaining space.
4. **Given** the app is open, **When** the user closes the window, **Then** the sbtask server shuts down cleanly.

---

### User Story 2 — Split-Pane Task Management (Priority: P1)

A user views their inbox in a two-column layout: the task list occupies the left 2/3, and selecting a task shows its detail on the right 1/3. The split pane is resizable by dragging the divider.

**Why this priority**: The split-pane is the core desktop productivity interaction — viewing tasks and their details simultaneously without modal sheets is the primary reason for a desktop layout.

**Independent Test**: Open the app. Verify the task list appears on the left. Click a task — verify its detail appears on the right panel. Drag the divider — verify both panels resize. Click a different task — verify the right panel updates.

**Acceptance Scenarios**:

1. **Given** the inbox is displayed, **When** the user clicks a task in the list, **Then** the right panel shows that task's markdown-rendered text, metadata, and action buttons (Mark Done, Edit).
2. **Given** a task detail is visible in the right panel, **When** the user clicks the Edit button, **Then** the editor opens inline in the right panel (no full-screen overlay).
3. **Given** the split pane is visible, **When** the user drags the divider left or right, **Then** both panels resize proportionally and the divider snaps to a minimum width of 200px per panel.
4. **Given** the window is narrower than 800px, **When** the user views the app, **Then** the layout collapses to single-column mobile mode (sidebar becomes tab bar, split pane becomes stack).

---

### User Story 3 — Configuration Manager (Priority: P2)

A user opens the Settings view to manage their sbtask spaces. They can add, edit, and remove spaces; set the active space; and configure per-space defaults (page name for new tasks, inbox page). Changes persist to the sbtask config file and take effect immediately.

**Why this priority**: Desktop users expect to configure their spaces without editing a YAML file by hand. This replaces the read-only space display with full CRUD.

**Independent Test**: Open Settings. Add a new space with name "Projects" and URL "https://projects.example.com". Verify it appears in the space switcher. Edit the space name. Delete the space. Verify config file reflects changes.

**Acceptance Scenarios**:

1. **Given** the Settings view is open, **When** the user clicks "Add Space", **Then** a dialog appears with fields for space name, URL, default page, and inbox page. Submitting creates the space in sbtask's config and the space switcher updates immediately.
2. **Given** a space exists in the list, **When** the user clicks "Edit", **Then** the same dialog opens pre-filled with the space's current values. Changes save on submit.
3. **Given** a space exists in the list, **When** the user clicks "Remove", **Then** a confirmation dialog appears. Confirming removes the space from config and the space switcher.
4. **Given** multiple spaces exist, **When** the user selects a different space as the active space, **Then** the change persists to config and all views reload with the new space's tasks.

---

### User Story 4 — Keyboard Navigation (Priority: P3)

A power user navigates Prowl entirely via keyboard. They can switch views, navigate the task list, open and edit tasks, mark tasks done, and create new tasks without touching the mouse.

**Why this priority**: Keyboard shortcuts are a quality-of-life enhancement for desktop power users. The app is fully functional without them; they provide speed and ergonomics.

**Independent Test**: With the app focused, press Ctrl+N — verify the quick capture input focuses. Press j/k — verify task list selection moves. Press Space — verify the selected task toggles done. Press Esc — verify the detail panel closes.

**Acceptance Scenarios**:

1. **Given** the app is focused, **When** the user presses Ctrl+N, **Then** the quick capture input receives focus and the user can type a task title.
2. **Given** the task list is visible, **When** the user presses j repeatedly, **Then** selection moves down through tasks; pressing k moves up. Each selection highlights in the list and shows details in the right panel.
3. **Given** a task is selected, **When** the user presses Space, **Then** the task toggles between done and active.
4. **Given** the detail panel is open, **When** the user presses Esc, **Then** the detail panel closes and focus returns to the task list.

---

### User Story 5 — Quick Capture as Top Bar (Priority: P3)

The quick capture input is visible as a persistent bar at the top of the main content area, styled as a search-like input. It is always accessible regardless of which view is active.

**Why this priority**: Desktop users benefit from an always-visible capture field. On mobile, the bottom bar works; on desktop, a top bar input aligns with common desktop app patterns.

**Independent Test**: Verify the quick capture input is visible at the top of every main view (Inbox, Today, Settings). Type a task title, press Enter — verify the task is created and appears in the list. The input clears and remains focused.

**Acceptance Scenarios**:

1. **Given** any main view is active, **When** the user looks at the top of the content area, **Then** a text input labeled "Add a task…" is visible.
2. **Given** the quick capture input has focus, **When** the user types a title and presses Enter, **Then** the task is created and appears in the task list.
3. **Given** the input is focused, **When** the user presses Esc, **Then** the input clears and blurs.

---

### Edge Cases

- What happens when sbtask serve fails to start at app launch? The Wails backend should surface the error in a native dialog and offer to open the config manager.
- What happens when the sbtask config file is missing or corrupted? The config manager should detect this and offer to create a default config with guided setup.
- What happens when the window is resized to very small dimensions? At <800px width, the layout collapses to single-column mobile mode (sidebar → tab bar, split pane → stack, bottom quick capture returns).
- What happens when the user rapidly switches spaces via keyboard? Task list reloads should be debounced to avoid flooding the API.
- What happens when the system WebView lacks WebKitGTK? The app should detect the missing dependency on launch and show a clear error message.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The desktop app MUST start sbtask serve as an in-process HTTP server on launch, binding to localhost:7433.
- **FR-002**: The app MUST render in a native window using the system WebView (WebKitGTK on Linux).
- **FR-003**: The UI MUST display a persistent sidebar with navigation items: Inbox, Today, Settings. The active item is highlighted.
- **FR-004**: The main content area MUST display as a resizable split pane: task list on the left, task detail/editor on the right.
- **FR-005**: At window widths below 800px, the layout MUST collapse to single-column mobile mode (sidebar → tab bar, split pane → stack).
- **FR-006**: The app MUST provide a configuration manager (native Go dialogs) for adding, editing, and removing spaces. Changes MUST write to the sbtask config.yaml file.
- **FR-007**: The app MUST support keyboard shortcuts: Ctrl+N (new task), / (focus search), j/k (navigate list), Space (toggle done), Esc (close detail).
- **FR-008**: Quick capture MUST be a persistent top bar input visible on all main views (Inbox, Today, Settings), styled as a search-like bar.
- **FR-009**: The app MUST shut down sbtask serve cleanly when the window closes (graceful HTTP server shutdown within 5 seconds).
- **FR-010**: The desktop app MUST reuse the same Svelte 5 codebase as the mobile app. Layout changes are achieved via CSS media queries and conditional rendering, not a code fork.
- **FR-011**: The sbtask integration MUST use Go library imports from the local sbtask source via a `replace` directive in go.mod (no shelling out to a binary, no Process/spawn).
- **FR-012**: The app MUST be buildable as a single binary (`prowl-desktop`) via Wails v3 on NixOS/Linux.
- **FR-013**: If sbtask serve fails to start, the app MUST show a native error dialog with the failure reason and an option to open the config manager.
- **FR-014**: The app MUST bundle all Svelte assets (HTML, CSS, JS) into the Go binary at build time — no external files, no dev server in production.

### Key Entities

- **Space configuration**: Name, URL, default page, inbox page. Stored in sbtask config.yaml. Mutable via the config manager.
- **Desktop layout state**: Selected task (for split pane detail), sidebar selection, split pane ratio. In-memory only, not persisted.

### Out of Scope *(explicit)*

- Tauri or Electron wrappers — Wails only
- System tray / background service
- Multi-window support
- Native OS notifications
- macOS or Windows builds (v1 is Linux-only)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The desktop app launches and displays the inbox with tasks in under 3 seconds on a modern Linux desktop.
- **SC-002**: The sbtask serve process starts and responds to health checks within 500ms of app launch.
- **SC-003**: Resizing the split pane divider is smooth — the UI re-renders within one frame (16ms).
- **SC-004**: The binary size is under 20MB (Go runtime + sbtask + Svelte bundle).
- **SC-005**: All 7 keyboard shortcuts work and produce the expected action within 200ms of keypress.
- **SC-006**: Switching spaces in the desktop app takes under 1 second from click to refreshed task list.
- **SC-007**: The layout collapses to mobile mode when the window is resized below 800px and expands back to desktop mode above 800px within one frame.

## Assumptions

- The user's Linux system has WebKitGTK installed (standard on most desktop Linux distributions, including NixOS with GNOME/KDE).
- sbtask source is available at the local path `/home/justin/development/go/sbtask` and is importable as a Go module via `replace` directive.
- The existing Svelte 5 codebase at `src/` is the single source of UI code for both desktop and mobile.
- Wails v3 is available via Nix (either from nixpkgs or as a flake input).
- The sbtask config file lives at `~/.config/sbtask/config.yaml` (same as CLI).
- The desktop app does not require Capacitor or any of its plugins — native features (haptics, Siri) are mobile-only and gracefully degrade to no-ops on desktop.
- The Vite build produces a static `dist/` directory that Wails embeds at compile time.
