# Feature Specification: Silvermind Mobile App

**Feature Branch: 001-silvermind-mobile-app`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User description: "Build a mobile app called 'Silvermind' using Capacitor that wraps a Svelte web UI around the sbtask CLI tool. The app embeds a pre-compiled sbtask binary for iOS and starts `sbtask serve` on app launch to expose the task API on localhost. The Svelte UI consumes the REST API endpoints (/tasks, /inbox, /today, /done, /undo) defined in the sbtask serve spec. The app should feel native on iPhone — smooth scrolling, swipe gestures, haptic feedback on task completion. No authentication is needed since the API runs on localhost."

## Clarifications

### Session 2026-06-18

- Q: What is explicitly out of scope for this feature? → A: Push notifications and recurring tasks are excluded.
- Q: How are tasks ordered in the inbox list? → A: Default sort is by priority (high → medium → none) then by creation date (newest first within each level); custom sorting options available.
- Q: What level of accessibility support is required? → A: Full accessibility — VoiceOver labels on all interactive elements, Dynamic Type text scaling, reduced motion support, and sufficient color contrast.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse Active Tasks & Mark Done (Priority: P1)

A user launches Silvermind and immediately sees their active tasks in an inbox list. They can scroll through tasks with native iPhone smoothness, pull down to refresh the list, and swipe a task to mark it as done — receiving haptic confirmation of completion.

**Why this priority**: This is the core task management loop. Without the ability to view and complete tasks, the app has no value. This story delivers the fundamental productivity interaction.

**Independent Test**: Launch the app with a running sbtask server that has pre-populated tasks. Verify the inbox displays tasks, pull-to-refresh triggers a reload, and swiping a task marks it done with haptic feedback. The test delivers the complete task viewing and completion workflow.

**Acceptance Scenarios**:

1. **Given** sbtask serve is running with active tasks in the default space, **When** the user opens the app, **Then** the inbox displays all active tasks in a scrollable list within 3 seconds.
2. **Given** the inbox is displayed, **When** the user pulls down on the list, **Then** the task list refreshes with the latest data from the sbtask API.
3. **Given** an active task is visible in the inbox, **When** the user swipes left on the task, **Then** the task is marked as done via the API, the device provides haptic feedback, and the task animates out of the list.
4. **Given** the inbox has no active tasks, **When** the user views the inbox, **Then** an empty state message is displayed indicating all tasks are complete.

---

### User Story 2 - Rapid Task Capture (Priority: P2)

A user wants to quickly capture a thought or task without navigating away from their current view. A persistent input bar at the bottom of the screen allows one-tap access to enter a new task title and save it immediately.

**Why this priority**: Quick capture is the entry point for all new tasks. Without it, users cannot add tasks from the mobile app, making the inbox read-only. This is the second most critical interaction after viewing.

**Independent Test**: From any main view (inbox, today, task detail), tap the bottom input bar, type a task title, and submit. Verify the task appears in the active list and is persisted via the API. No other views are required for this test.

**Acceptance Scenarios**:

1. **Given** the app is open on any main view, **When** the user taps the persistent bottom input bar, **Then** the input field receives focus and the keyboard appears.
2. **Given** the input bar has focus, **When** the user types a task title and taps submit, **Then** the task is created via the API and appears in the inbox list.
3. **Given** the input bar has focus with text entered, **When** the user taps cancel or dismisses the keyboard without submitting, **Then** the input is cleared and the bar returns to its idle state.
4. **Given** the input bar is empty, **When** the user attempts to submit, **Then** submission is prevented (no empty tasks created).

---

### User Story 3 - Today View with Time-Based Organization (Priority: P2)

A user wants to see what needs their attention today. The today view groups tasks into three sections: overdue tasks (past their due date), tasks due today, and tasks scheduled for today. This gives the user a clear picture of their daily priorities.

**Why this priority**: Time-awareness is critical for task management. Users need to distinguish between what's urgent (overdue), what's due now, and what's planned. This view complements the inbox by adding temporal context.

**Independent Test**: With tasks in varying states (overdue, due today, scheduled today), navigate to the today view and verify tasks appear in the correct sections. No other views are required.

**Acceptance Scenarios**:

1. **Given** tasks exist with past due dates, **When** the user opens the today view, **Then** overdue tasks are displayed in an "Overdue" section at the top.
2. **Given** tasks exist with today's due date, **When** the user opens the today view, **Then** those tasks are displayed in a "Due Today" section.
3. **Given** tasks are scheduled for today, **When** the user opens the today view, **Then** those tasks are displayed in a "Scheduled Today" section.
4. **Given** no tasks match any today criteria, **When** the user opens the today view, **Then** each section shows an empty state message.

---

### User Story 4 - Task Detail & Attribute Editing (Priority: P3)

A user taps a task to see its full details and edit attributes such as due date, description, priority, and schedule. The detail view provides a focused editing experience for refining task metadata beyond the title.

**Why this priority**: While quick capture handles task creation, users need to refine tasks with dates, descriptions, and priorities to fully leverage the sbtask workflow. This adds depth to task management.

**Independent Test**: From the inbox or today view, tap a task to open its detail view. Edit one or more attributes (e.g., due date, description) and save. Verify the changes persist via the API and are reflected when returning to the list. No other views are required.

**Acceptance Scenarios**:

1. **Given** a task is displayed in a list, **When** the user taps the task, **Then** the task detail view opens displaying all available attributes (title, description, due date, priority, scheduled date, space).
2. **Given** the task detail view is open, **When** the user edits an attribute (e.g., sets a due date) and saves, **Then** the change persists via the API and is visible upon returning to the list.
3. **Given** the task detail view is open, **When** the user navigates back without saving changes, **Then** unsaved edits are discarded and the original values are preserved.
4. **Given** the task detail view is open, **When** the user deletes the task, **Then** the task is removed via the API and the user returns to the previous list view.

---

### User Story 5 - Space Switching (Priority: P3)

A user with multiple configured spaces (e.g., "Work", "Personal", "Side Project") needs to toggle between them to see the right tasks in context. A space switcher button allows selecting the active space, and all views update to reflect the selected space's tasks.

**Why this priority**: Multi-space support is a power-user feature. While important for users with multiple contexts, the app is fully functional with a single default space. This story enhances organizational capability.

**Independent Test**: With the sbtask server configured with multiple spaces, use the space switcher to change the active space. Verify the inbox, today view, and quick capture all reflect the selected space. Switch back and confirm data isolation between spaces.

**Acceptance Scenarios**:

1. **Given** multiple spaces are configured in sbtask, **When** the user taps the space switcher button, **Then** a list of available spaces is displayed.
2. **Given** the space list is open, **When** the user selects a different space, **Then** all views (inbox, today) refresh to show tasks from the selected space.
3. **Given** a space is selected, **When** the user creates a task via quick capture, **Then** the task is created in the currently selected space.
4. **Given** the app is closed and reopened, **When** the app launches, **Then** the last selected space is restored.

---

### Edge Cases

- What happens when the sbtask `serve` process fails to start on app launch? The app should display an error state with a retry option and clear messaging that the task service is unavailable.
- What happens when the API is unreachable mid-session (e.g., sbtask process crashes)? The app should surface a non-intrusive error indicator and automatically attempt to reconnect or restart the service.
- What happens when the user has no spaces configured? The app should fall back to a default space and allow task management without requiring explicit space setup.
- What happens when a network connection is not available? Since sbtask runs on localhost, a network connection is not required. The app should function fully offline.
- What happens when the sbtask binary is missing or incompatible with the device? The app should detect this on first launch and display a clear error message rather than crashing silently.
- How does the app handle rapid successive API calls (e.g., quickly completing multiple tasks)? The app should queue or debounce requests to avoid overwhelming the local server.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The app MUST start the local task service on launch, making tasks available for display and interaction.
- **FR-002**: The app MUST display an inbox list of all active tasks fetched from the local task service with 60fps scrolling and no visible stutter. Tasks MUST be sorted by priority (high → medium → none) then by creation date (newest first) by default, with user-selectable alternative sort options available.
- **FR-003**: The app MUST support pull-to-refresh on task lists, re-fetching data from the local task service.
- **FR-004**: Users MUST be able to mark a task as done by swiping left on it, which updates the task via the local task service (see FR-013 for haptic feedback requirement).
- **FR-005**: Users MUST be able to undo a completed task, restoring it to active status via the local task service.
- **FR-006**: The app MUST provide a persistent bottom input bar for rapid task entry, creating tasks via the local task service.
- **FR-007**: The app MUST display a today view with three sections: overdue tasks, tasks due today, and tasks scheduled for today, all fetched from the local task service.
- **FR-008**: Users MUST be able to tap a task to open a detail view showing all task attributes (title, description, due date, priority, scheduled date, space).
- **FR-009**: Users MUST be able to edit task attributes from the detail view and persist changes via the local task service.
- **FR-010**: Users MUST be able to delete a task from the detail view, removing it via the local task service.
- **FR-011**: The app MUST provide a space switcher that lists all configured spaces from the sbtask configuration and allows the user to change the active space.
- **FR-012**: The app MUST persist the user's last selected space across app restarts.
- **FR-013**: The app MUST provide haptic feedback on task completion, task creation, and deletion as confirmation of the action.
- **FR-014**: The app MUST display a splash screen on launch while the local task service initializes.
- **FR-015**: The app MUST adapt the status bar appearance to match the app's light/dark theme.
- **FR-016**: The app MUST support accessibility features: VoiceOver labels on all interactive elements, Dynamic Type text scaling, reduced motion support (disabling non-essential animations), and sufficient color contrast (WCAG AA minimum) throughout the UI.
- **FR-017**: The app MUST support Siri Shortcuts integration, allowing users to create a new task or open a specific view (inbox, today) via voice command or the Shortcuts app.
- **FR-018**: The app MUST handle local task service startup failures gracefully, displaying a user-facing error state with a retry mechanism.
- **FR-019**: The app MUST handle local task service unavailability mid-session by showing a non-blocking error indicator and attempting automatic reconnection.
- **FR-020**: The app MUST prevent creation of empty tasks (blank title) in the quick capture input.
- **FR-021**: The app MUST function without requiring any external network connection, as all communication is with the local task service on the device.

### Key Entities

- **Task**: Represents a single task item managed by sbtask. Key attributes include title, description, due date, priority, scheduled date, completion status, and associated space. Tasks are the central data entity throughout all views.
- **Space**: Represents a named context or workspace for organizing tasks (e.g., "Work", "Personal"). A space contains its own set of tasks and is defined in the sbtask configuration. The active space determines which tasks are displayed across all views.

### Out of Scope *(explicit)*

- Push notifications for task reminders or updates
- Recurring / repeating tasks

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The app launches and displays the inbox with tasks in under 3 seconds on a modern iPhone (iPhone 14 or newer).
- **SC-002**: Task completion via swipe feels instantaneous — from swipe gesture to haptic feedback and task removal, the interaction completes in under 1 second.
- **SC-003**: Pull-to-refresh completes and displays updated task data in under 1 second.
- **SC-004**: A user can capture a new task via the quick input bar in under 5 seconds from app open.
- **SC-005**: Scrolling through a task list of 100+ items maintains 60fps with no visible stutter or jank.
- **SC-006**: 100% of user actions (complete task, create task, edit task, delete task) receive appropriate haptic or visual feedback confirming the result.
- **SC-007**: The app functions fully offline with no degradation in performance or feature availability.
- **SC-008**: Switching between spaces and seeing updated task lists completes in under 1 second.
- **SC-009**: The app recovers from a crashed task service and restores full functionality within 5 seconds without requiring a manual app restart.

## Assumptions

- The sbtask binary is pre-compiled for iOS arm64 (with CGO_ENABLED=0) and bundled with the app package. The binary is fetched from the sbtask git repository at the latest release tag.
- The sbtask `serve` command listens on localhost and exposes REST API endpoints (`/tasks`, `/inbox`, `/today`, `/done`, `/undo`) as defined in the sbtask serve specification.
- The sbtask configuration file (defining spaces and other settings) is accessible from the app's sandboxed file system and shares the same format as the CLI configuration.
- The app is built for iOS using Capacitor with cloud build services (EAS), developed on a Linux workstation.
- The Svelte 5 UI uses runes mode and communicates with the local sbtask API via standard HTTP requests to localhost.
- Capacitor plugins provide native functionality: haptics (@capacitor/haptics), status bar (@capacitor/status-bar), splash screen (@capacitor/splash-screen), and Siri Shortcuts integration.
- No user authentication is required since all API communication is restricted to localhost within the device.
- The app targets iPhone running iOS 16 or later.
- The space switcher fetches the list of available spaces from the sbtask configuration and allows runtime switching.
