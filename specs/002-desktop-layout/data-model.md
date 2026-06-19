# Data Model: Prowl Desktop Layout

**Date**: 2026-06-19
**Feature**: [spec.md](./spec.md)

## New Entities

### SpaceConfig

Managed by the Wails Go backend. Represents a single SilverBullet space configured in sbtask's config.yaml.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | yes | Unique identifier for the space (e.g., "notes", "household") |
| `url` | string | yes | SilverBullet space URL (e.g., "https://notes.fluffy-rooster.ts.net") |
| `default_page` | string | no | Default page for new tasks (default: "Tasks") |
| `inbox_page` | string | no | Page for quick inbox capture (default: "Inbox") |

**Storage**: `~/.config/sbtask/config.yaml` in YAML format. Read/written by Go backend. Same format as sbtask CLI.

**Example**:
```yaml
spaces:
  notes:
    space: https://notes.fluffy-rooster.ts.net
    default_page: Tasks
    inbox_page: Inbox
  household:
    space: https://household.fluffy-rooster.ts.net
    default_page: HouseholdTasks
    inbox_page: Inbox
active_space: notes
```

### AppConfig (in-memory)

Runtime state managed by the Wails Go backend, passed to frontend on startup.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spaces` | SpaceConfig[] | yes | All configured spaces |
| `active_space` | string | yes | Name of the currently active space |

### DesktopLayoutState (Svelte in-memory)

UI-only state, not persisted.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `selectedTask` | Task \| null | yes | Currently selected task in the split pane detail |
| `sidebarActive` | string | yes | Active sidebar item ("inbox", "today", "settings") |
| `splitRatio` | number | yes | Left panel width fraction (default 0.66) |

**State transitions**: `selectedTask` changes on task click in the list panel. `sidebarActive` changes on sidebar navigation. `splitRatio` changes on divider drag.

### ServiceHealth (Go backend)

Same structure as the existing Svelte service store, tracked by the Go backend.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `state` | enum | yes | "starting", "running", "unhealthy", "failed" |
| `port` | number | yes | Port sbtask serve is bound to (default 7433) |
| `space_url` | string | yes | Active space's SilverBullet URL |
| `error` | string | no | Last error message if unhealthy/failed |

**State transitions**:
```
[start] → starting → running ⇄ unhealthy → failed
```

## Existing Entities (Unchanged)

- **Task** — same as mobile (`src/lib/types/task.ts`)
- **Space** — same as mobile (`src/lib/types/space.ts`)

## Relationships

```
AppConfig 1──* SpaceConfig
SpaceConfig ── sbtask serve (one HTTP server serves the active space)
```

No new persistence beyond sbtask's config.yaml. Desktop layout state is ephemeral.
