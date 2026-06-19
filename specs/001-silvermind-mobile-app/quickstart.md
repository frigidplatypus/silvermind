# Quickstart: Validating Silvermind End-to-End

**Date**: 2026-06-18
**Purpose**: Runnable validation scenarios that prove the feature works. Use this as a manual or CI smoke test after building the app.

## Prerequisites

Before you start:

1. **sbtask binary** — either built locally or downloaded. For iOS, must be `arm64` with `CGO_ENABLED=0`.
2. **iOS development environment** — either:
   - A macOS machine with Xcode 15+ for local builds, OR
   - Capacitor Cloud Build (EAS) credentials for Linux-based builds.
3. **Node.js 20+** for the Svelte build tooling.
4. **pnpm or npm** for package management.

## One-Time Setup

### 1. Clone and install

```bash
cd prowl
pnpm install   # or npm install
```

### 2. Fetch the sbtask binary

```bash
# From the sbtask git remote, latest release tag, cross-compiled for iOS arm64
./scripts/fetch-sbtask.sh ios-arm64
# Output: ./ios/App/sbtask (arm64, ~6-10MB)
```

The script uses `git ls-remote` to find the latest release tag, downloads the source, and cross-compiles with:

```
CGO_ENABLED=0 GOOS=darwin GOARCH=arm64 go build -o ios/App/sbtask
```

### 3. Set up sbtask config (first run only)

Create a minimal sbtask config for testing:

```bash
mkdir -p ~/.config/sbtask
cat > ~/.config/sbtask/config.yaml <<EOF
spaces:
  - id: spc_personal
    name: Personal
    is_default: true
  - id: spc_work
    name: Work
    is_default: false
EOF
```

This config will be embedded in the iOS app's sandbox at first launch.

## Build & Run

### Option A: Local iOS Simulator (macOS only)

```bash
# Add iOS platform (one time)
pnpm cap add ios

# Sync web build to native project
pnpm build && pnpm cap sync ios

# Open in Xcode
pnpm cap open ios
# In Xcode: select an iPhone 14+ simulator and Run (Cmd+R)
```

### Option B: Cloud Build (Linux-friendly)

```bash
# Configure EAS or your chosen cloud build service
pnpm build && pnpm cap sync ios
eas build --platform ios
# Or: submit to your cloud Xcode service
```

The cloud build runs the iOS toolchain remotely and produces an .ipa you can install via TestFlight or sideload.

## Validation Scenarios

Each scenario maps to one or more acceptance criteria from [spec.md](./spec.md). Run them in order; each is independent.

### Scenario 1: Cold Launch to Inbox (SC-001, FR-001, FR-002)

**Setup**: Ensure at least 5 active tasks exist in the default space (use `sbtask add` from your dev machine if testing on simulator with a shared config; on real device, the config is in the app sandbox).

**Steps**:
1. Force-quit the app.
2. Launch the app from the home screen.
3. Time the launch: from app icon tap to inbox visible.

**Expected**:
- Inbox displays the active tasks within 3 seconds (SC-001).
- Splash screen shows during initial boot.
- No external network requests are made (verify in DevTools or by airplane-mode test).

### Scenario 2: Pull-to-Refresh (FR-003, SC-003)

**Setup**: From the inbox view.

**Steps**:
1. Pull down on the task list.
2. Time the refresh.

**Expected**:
- Refresh completes within 1 second (SC-003).
- The list reflects any changes made externally (e.g., via sbtask CLI on the same config).

### Scenario 3: Swipe to Mark Done (FR-004, FR-013, SC-002)

**Setup**: At least one active task in the inbox.

**Steps**:
1. Swipe left on a task.
2. Note the haptic feedback and animation.

**Expected**:
- Haptic feedback fires (FR-013).
- Task is removed from the inbox within 1 second of swipe (SC-002).
- Task no longer appears in the inbox; a corresponding `done` event was sent to sbtask.

**Verify externally**:
```bash
sbtask list  # Task should not appear in active list
```

### Scenario 4: Quick Capture (FR-006, FR-013, SC-004)

**Setup**: On any main view (inbox, today, detail).

**Steps**:
1. Tap the bottom input bar.
2. Type "Buy milk".
3. Tap submit.
4. Time the operation.

**Expected**:
- Keyboard appears when the bar is tapped.
- Task is created and appears in the inbox within 5 seconds of app open (SC-004).
- Haptic feedback fires on success.
- Empty submission is rejected silently (no task created).

### Scenario 5: Today View (FR-007)

**Setup**: Create tasks with different states:
- One overdue (due_date = yesterday)
- One due today (due_date = today)
- One scheduled today (scheduled_date = today)
- One in the future (due_date = tomorrow)

**Steps**:
1. Navigate to the Today view.
2. Verify each section.

**Expected**:
- Overdue section at top, with the overdue task.
- Due Today section, with the task due today.
- Scheduled Today section, with the scheduled task.
- The future-dated task does NOT appear in any section.

### Scenario 6: Task Detail & Edit (FR-008, FR-009, FR-010)

**Setup**: A task in the inbox.

**Steps**:
1. Tap the task to open detail view.
2. Verify all attributes are visible (title, description, due_date, priority, scheduled_date, space).
3. Edit the description, save.
4. Return to inbox; verify the change persisted.

**Expected**:
- Detail view shows all task attributes.
- Edit persists via the API.
- Back navigation discards unsaved changes.

### Scenario 7: Space Switching (FR-011, FR-012, SC-008)

**Setup**: Multiple spaces configured (Personal, Work).

**Steps**:
1. Use the space switcher to select Work.
2. Verify the inbox shows only Work tasks.
3. Create a new task via quick capture.
4. Verify the new task appears in Work, not Personal.
5. Force-quit and relaunch the app.
6. Verify Work is still the active space.

**Expected**:
- Space switcher lists all configured spaces.
- All views (inbox, today) refresh within 1 second of selection (SC-008).
- New tasks go to the active space.
- Last selected space is restored on relaunch (FR-012).

### Scenario 8: Service Failure & Recovery (FR-018, SC-009)

**Setup**: App running normally.

**Steps**:
1. Kill the sbtask process externally (e.g., via the debug menu or by killing the child process from the host).
2. Wait for the app to detect the failure.
3. Wait for the automatic restart attempt.
4. Verify the app recovers without user intervention.

**Expected**:
- A non-blocking error indicator appears within 2 seconds of service loss.
- The app automatically restarts the service.
- Full functionality is restored within 5 seconds (SC-009).
- No manual app restart is required.

### Scenario 9: Accessibility (FR-016)

**Setup**: Enable VoiceOver in iOS Settings.

**Steps**:
1. VoiceOver each view (inbox, today, detail).
2. Verify labels on all interactive elements.
3. Switch to a larger Dynamic Type size in iOS Settings.
4. Verify text scales.
5. Enable Reduce Motion in iOS Settings.
6. Verify swipe animations are minimized or removed.

**Expected**:
- All buttons, task rows, and inputs have meaningful VoiceOver labels.
- Text scales up with Dynamic Type.
- Animations are reduced or removed when Reduce Motion is on.
- Color contrast passes WCAG AA (use a contrast checker on the actual UI).

### Scenario 10: Offline Mode (FR-021)

**Setup**: App running with tasks visible.

**Steps**:
1. Enable airplane mode on the device.
2. Use the app: view inbox, mark tasks done, create tasks, switch spaces.

**Expected**:
- All features work normally with no degradation (SC-007).
- No error messages about network connectivity.
- All operations are local (loopback to sbtask).

## CI Smoke Test

A minimal CI pipeline can validate:

```bash
pnpm install
pnpm build
pnpm test        # vitest unit + component tests
pnpm test:e2e    # Playwright against a stub sbtask server
```

The stub server (see [contracts/sbtask-api.md](./contracts/sbtask-api.md)) should implement at minimum: `/tasks`, `/inbox`, `/today`, `/done`, `/undo`, `/health`, and `/spaces`, returning fixture data.

## Troubleshooting

- **App stuck on splash screen**: the sbtask binary may not have launched. Check device logs for the `sbtask-ios` plugin output. Verify the binary is at `ios/App/sbtask` and is executable.
- **API calls return 0 or fail immediately**: confirm the sbtask service is listening on `127.0.0.1:7433`. The plugin logs the actual port at startup.
- **No haptic feedback**: haptics only fire on physical devices, not simulators.
- **Siri Shortcuts don't appear in the Shortcuts app**: the App Intents need to be registered on first run. Reinstall the app or trigger the "Donate" call from the debug menu.

## Next Steps After Validation

- Once all 10 scenarios pass, the app is feature-complete for v1.
- For deployment, run a release build via EAS, submit to TestFlight, then to the App Store.
- Run `/speckit.tasks` to generate the implementation task list (if not already done).
