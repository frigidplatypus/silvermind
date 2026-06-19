# Data Model: Prowl Mobile App

**Date**: 2026-06-18
**Feature**: [spec.md](./spec.md)
**Source-of-truth note**: sbtask owns all task and space data. Prowl is a thin client that reads from and writes to the sbtask REST API. The model below is the **consumer view** of sbtask's data, used to define types, validation, and UI representation in the Svelte app.

## Entity: Task

Represents a single task item managed by sbtask.

### Fields

| Field          | Type     | Required | Description                                                                  |
|----------------|----------|----------|------------------------------------------------------------------------------|
| `id`           | string   | yes      | sbtask-assigned unique identifier. Used as React/Svelte key.                 |
| `title`        | string   | yes      | Human-readable task name. 1-200 characters. Non-empty.                       |
| `description`  | string?  | no       | Optional long-form notes. Up to 4000 characters.                             |
| `status`       | enum     | yes      | One of: `active`, `done`. (Future: `cancelled` — not in v1.)                  |
| `priority`     | enum     | yes      | One of: `high`, `medium`, `none`. Default `none`.                            |
| `due_date`     | date?    | no       | ISO-8601 date (YYYY-MM-DD) or null. Past dates = overdue.                    |
| `scheduled_date` | date?  | no       | ISO-8601 date. Tasks appear in "Scheduled Today" if == today.                |
| `space_id`     | string   | yes      | Foreign key to Space.                                                        |
| `created_at`   | datetime | yes      | ISO-8601 datetime. UTC. Used for default sort.                               |
| `updated_at`   | datetime | yes      | ISO-8601 datetime. UTC.                                                       |
| `completed_at` | datetime? | no       | ISO-8601 datetime. UTC. Set when status transitions to `done`.               |

### Validation Rules

- `title`: trimmed, non-empty, max 200 characters. Spec FR-020.
- `description`: max 4000 characters, may be empty string or null.
- `due_date` and `scheduled_date`: valid ISO-8601 date or null.
- `priority`: must be one of the three values.
- `status`: must be `active` or `done`.
- `space_id`: must reference an existing space (validated by sbtask).

### State Transitions

```
       create
   ┌─────────────► [active] ──────mark done──────► [done]
       (status=active)                              │
                            ◄──────undo──────────────┘
                                                   (status=done)
                            (status=active, completed_at=null)
```

Transitions are triggered by user actions:
- `active → done`: swipe left in inbox/today (FR-004). Sets `completed_at = now`.
- `done → active`: undo action (FR-005). Clears `completed_at`.
- `→ active` (create): quick capture (FR-006) or detail view save (FR-009).

No other transitions are allowed in v1. Recurring tasks are explicitly out of scope (clarification Q1).

### Relationships

- **Belongs to**: one Space (`space_id`).
- **Referenced by**: nothing else in v1 (no subtasks, no dependencies).

### Indexes / Sort Keys (consumer concern)

For inbox default sort (clarification Q2): `(priority, -created_at)`.

## Entity: Space

Represents a named context or workspace for organizing tasks.

### Fields

| Field       | Type     | Required | Description                                              |
|-------------|----------|----------|----------------------------------------------------------|
| `id`        | string   | yes      | sbtask-assigned unique identifier.                       |
| `name`      | string   | yes      | Human-readable space name. 1-50 characters.              |
| `is_default`| boolean  | yes      | True if this is the default space (used when none selected). |
| `created_at`| datetime | yes      | ISO-8601 datetime. UTC.                                  |

### Validation Rules

- `name`: trimmed, non-empty, max 50 characters.
- `is_default`: exactly one space per sbtask config should be `is_default: true`.

### State Transitions

Spaces are managed outside of Prowl (in sbtask CLI). The app reads but does not create, edit, or delete spaces.

### Relationships

- **Has many**: Tasks (`Task.space_id` → `Space.id`).

## Entity: ActiveSpacePreference

A tiny Prowl-only entity (lives in Capacitor Preferences, not sbtask).

### Fields

| Field         | Type   | Required | Description                                                |
|---------------|--------|----------|------------------------------------------------------------|
| `active_space_id` | string | yes   | The `Space.id` the user last selected. Persisted across launches (FR-012). |

### Validation Rules

- `active_space_id`: must be a valid `Space.id` known to sbtask at app start.
- If the persisted value doesn't match any current space, fall back to `is_default: true` space, or the first space in the list.

## Entity: ServiceHealth

An ephemeral runtime entity tracked by the `sbtask-ios` Capacitor plugin and exposed to the Svelte layer.

### Fields

| Field          | Type    | Description                                                       |
|----------------|---------|-------------------------------------------------------------------|
| `state`        | enum    | `starting`, `running`, `unhealthy`, `restarting`, `failed`.        |
| `last_ok_at`   | datetime? | UTC timestamp of the last successful health check.                |
| `restart_count`| integer | Number of restart attempts in the current session.                 |
| `last_error`   | string? | Most recent error message, if any.                                |

### State Transitions

```
[start] → starting → running
                     │
                     ▼
                  unhealthy ──► restarting ──► running
                     │                │
                     ▼                ▼
                  failed         (3 fails → failed)
```

## UI-State Entities (Svelte runes)

These are not persisted and exist only inside the Svelte app.

### SortSelection

| Field   | Type   | Default                      | Description                              |
|---------|--------|------------------------------|------------------------------------------|
| `mode`  | enum   | `priority-then-date`         | One of: `priority-then-date`, `created-desc`, `due-asc`, `alpha-asc`. |

### TaskListFilter (optional, v1 may not expose)

| Field     | Type      | Default     | Description                          |
|-----------|-----------|-------------|--------------------------------------|
| `query`   | string    | `""`        | Free-text filter on title.           |
| `priority`| enum[]    | `[]`        | Filter to specific priorities.       |

Out of v1 scope unless added; defer to a later feature.

## ER Diagram (textual)

```
┌────────────────────┐ 1     * ┌────────────────────┐
│ Space              │─────────│ Task               │
│ ───────────        │         │ ───────────        │
│ id (PK)            │         │ id (PK)            │
│ name               │         │ title              │
│ is_default         │         │ description        │
│ created_at         │         │ status             │
└────────────────────┘         │ priority           │
                               │ due_date           │
                               │ scheduled_date     │
                               │ space_id (FK)      │
                               │ created_at         │
                               │ updated_at         │
                               │ completed_at       │
                               └────────────────────┘

┌────────────────────┐
│ ActiveSpacePref    │  (Prowl-side, not sbtask)
│ ─────────────      │
│ active_space_id    │
└────────────────────┘
```

## Cardinalities

- One Space → many Tasks
- One ActiveSpacePreference per Prowl install
- No other relationships

## Data Volume Assumptions

- Tasks per space: typical 10-100, max 1000 (informal — sbtask stores this).
- Total tasks across all spaces: typical 50-500, max 5000.
- Spaces: typical 1-5, max ~20.
- Active list view (inbox/today) renders 100+ items (SC-005).

These inform the list virtualization decision in research.md (we render all items with keyed each; virtualization deferred).
