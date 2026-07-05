# Feature Specification: JS-Native Backend (Strip sbtask)

**Feature Branch**: `003-js-native-backend`

**Created**: 2026-06-30

**Status**: Draft

**Input**: User description: "Strip the sbtask Go dependency from all builds (desktop, web, mobile). Recreate each element of sbtask — parsing, editing, queries, config — in a Wails-native way using TypeScript running in the WebView. No more Go backend. No more subprocess management on iOS/Android. Keep the existing frontend components and UX unchanged."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Desktop app works identically (Priority: P1)

A user opens Silvermind desktop. They connect to their SilverBullet space, see their task inbox, create a new task, mark one complete, and archive done tasks. Everything works exactly as before. The user notices no difference in behavior, speed, or appearance.

**Why this priority**: Must not regress existing functionality. Desktop users are the primary audience.

**Independent Test**: Launch the app against a live SilverBullet space. Verify inbox loads, task CRUD operations succeed, archive endpoint moves done tasks under the archive header.

**Acceptance Scenarios**:

1. **Given** a configured space, **When** the app launches, **Then** the inbox displays current tasks within 2 seconds.
2. **Given** an active task, **When** the user toggles it done, **Then** the task is marked `[x]` on the SilverBullet page and disappears from the inbox.
3. **Given** completed tasks on a page, **When** the user runs archive, **Then** done tasks move under a `## Task Archive` header and active tasks remain in place.
4. **Given** a task with attributes ([due:], [priority:], [recur:]), **When** it is created or edited, **Then** all attributes are preserved in the markdown.

---

### User Story 2 — Browser-only dev loop (Priority: P1)

A developer runs `pnpm dev`. The full app loads in a browser tab, connects to their local SilverBullet instance, and all task operations work. No Go process runs — only Vite and the browser. The developer can inspect the app, debug with browser DevTools, and iterate quickly.

**Why this priority**: Developer velocity — single-language, single-process dev loop.

**Independent Test**: `pnpm dev` with a running SilverBullet instance on localhost. Verify all pages render, task list loads, task operations succeed, and no Go process is running.

**Acceptance Scenarios**:

1. **Given** `pnpm dev` is running, **When** navigating to the inbox, **Then** tasks load from SilverBullet via the Vite proxy.
2. **Given** the browser DevTools are open, **When** creating a task, **Then** the network tab shows a direct fetch to the SilverBullet filesystem API.

---

### User Story 3 — Simplified iOS build (Priority: P2)

A developer builds the iOS app. They run `pnpm cap:sync` and open Xcode. The app builds and deploys without any `pnpm sbtask:fetch` step. The app bundle is 14MB smaller. The app starts and loads tasks directly from the configured SilverBullet space — no subprocess binary runs in the background.

**Why this priority**: Eliminates the primary pain point — cross-compilation complexity and subprocess lifecycle fragility.

**Independent Test**: Build the iOS app in Xcode, deploy to a device, verify the app launches, connects to a SilverBullet space, and loads tasks. Check that no `sbtask` binary exists in the app bundle.

**Acceptance Scenarios**:

1. **Given** a clean iOS project, **When** building with `pnpm cap:sync && cap open ios`, **Then** the build succeeds without any Go cross-compilation step.
2. **Given** the app is running on an iOS device, **When** the user adds a space URL, **Then** the app connects directly to SilverBullet and loads tasks.

---

### User Story 4 — Config survives restarts (Priority: P2)

A user configures their SilverBullet space (URL, active space name) in Silvermind. They close and reopen the app on any platform. Their spaces are still there. They don't need to reconfigure.

**Why this priority**: Fundamental user expectation — configuration is persistent.

**Independent Test**: Add a space, restart the app, verify the space is still listed in the space switcher and marked active.

**Acceptance Scenarios**:

1. **Given** a space was added on desktop, **When** the app restarts, **Then** the space appears in the switcher without reconfiguration.
2. **Given** a space was added on iOS, **When** the app is force-quit and relaunched, **Then** the space persists.
3. **Given** the browser dev environment, **When** the page is refreshed, **Then** the space config persists in localStorage.

---

### Edge Cases

- SilverBullet is unreachable: Show "Cannot reach server at `<URL>`" error message in the UI.
- SilverBullet returns 503 (Runtime API unavailable): Show clear error explaining the Runtime API requirement.
- Page not found on SilverBullet: Return an empty task list, not crash.
- Concurrent page editing (If-Match fails): Retry the operation up to 3 times, then show a conflict error.
- Very large pages (500+ tasks): Load progressively, show loading indicator.
- Auth token with special characters: URL-encode properly in all fetch requests.
- Wiki links in task text: Convert `[[Journal/2026-06-30]]` to clickable links.
- Journal links with times: Preserve `[[Journal/2026-06-30]] 14:00` format.
- Monthly recurrence on month boundaries: `monthly:1` on Jan 31 advances to Feb 28 (not Mar 3).
- Leap year yearly recurrence: `yearly:1` on Feb 29 advances to Feb 28 in non-leap years.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST parse task lines from SilverBullet page markdown using the format `- [status] text [key: val]...`
- **FR-002**: System MUST serialize tasks back to markdown with attributes in a stable, sorted order
- **FR-003**: System MUST support all task operations: create, read, update, delete, toggle done, toggle undone, archive
- **FR-004**: System MUST advance task recurrence on completion: daily, weekly, monthly, yearly intervals
- **FR-005**: System MUST parse natural language date expressions ("tomorrow", "next monday", "in 3 days")
- **FR-006**: System MUST support SLIQ query syntax: `status == "x"`, `due < "2026-01-01"`, `has #tag`, `overdue`, `blocked`, `sort due asc`
- **FR-007**: System MUST implement atomic page updates using the SilverBullet filesystem API with `If-Match` header
- **FR-008**: System MUST retry on `412 Precondition Failed` responses (up to 3 times)
- **FR-009**: System MUST load and save space configuration (URLs, active space) persistently across app restarts on all platforms
- **FR-010**: System MUST use the appropriate HTTP transport on each platform: direct fetch (desktop WebView), native HTTP (mobile Capacitor), Vite proxy (browser dev)
- **FR-011**: System MUST expose configuration file I/O and notification capabilities to the frontend via the platform bridge
- **FR-012**: System MUST report errors using a consistent format with code, message, and HTTP status
- **FR-013**: System MUST convert SilverBullet wiki links (`[[Page]]`) to clickable links in rendered task text
- **FR-014**: System MUST apply the full task filter pipeline: overdue filtering, blocked computation, tag filtering, status filtering, parent/orphan/recur filtering, tag exclusion, hard exclusions
- **FR-015**: Frontend Svelte components, routes, and stores MUST remain unchanged — their API surface stays identical

### Key Entities *(include if feature involves data)*

- **Task**: A parsed task line with page, position, text, status, done flag, due date, deferred date, name, priority, tags, parent reference, dependencies, blocked flag, recurrence rule, alerts, and custom attributes
- **TaskFilter**: Query parameters for filtering tasks: statuses, page, date ranges, priority, tags, exclusions, sort order, limits
- **SpaceConfig**: A named space configuration with URL, default page, inbox page, and optional authentication token
- **QueryBlock**: A saved SLIQ query on a SilverBullet page, identified by page, block number, title, and query string
- **SilverBulletPage**: A page's raw markdown content with a last-modified timestamp for optimistic concurrency

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Task inbox loads within 2 seconds for pages with up to 200 tasks
- **SC-002**: All existing task operations (create, edit, toggle done, undo, archive) produce identical SilverBullet page content as the current Go backend
- **SC-003**: The iOS app bundle shrinks by at least 10MB (no Go binary)
- **SC-004**: Building for iOS goes from 3 steps (`sbtask:fetch` + `cap:sync` + `cap:open`) to 2 steps (`cap:sync` + `cap:open`)
- **SC-005**: Developer can run `pnpm dev` and use the full app without any Go process running
- **SC-006**: Space configuration persists across app restarts on desktop (file), mobile (app sandbox), and web (localStorage)
- **SC-007**: Concurrent page edit conflicts retry transparently — users see no error unless 3 retries all fail
- **SC-008**: A non-technical user can complete the onboarding flow (connect a space) without encountering any Go-related error messages or process management concerns

## Assumptions

- SilverBullet is accessible via HTTPS with a valid certificate from the client platform
- SilverBullet exposes the filesystem API (`/.fs/*`) and Runtime API (`/.runtime/objects/task`)
- Desktop WebView (WebKitGTK) does not enforce CORS — direct fetch() works
- Mobile Capacitor WebViews enforce CORS — the `@capacitor/http` plugin provides a native HTTP transport that bypasses it
- The `chrono-node` library provides equivalent natural language date parsing to Go's `when` library
- The existing frontend components (TaskRow, TaskList, TaskEditor, etc.) consume the Task TypeScript interface and will not need modification
- Silvermind owns its own configuration file — no migration from sbtask config is needed
- SilverBullet auth tokens are safe to include in direct requests from the WebView to SilverBullet
