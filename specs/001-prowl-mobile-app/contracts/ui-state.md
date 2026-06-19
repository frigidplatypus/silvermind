# UI State Contract

**Date**: 2026-06-18
**Purpose**: Define the in-memory and persisted state shape of the Svelte 5 UI layer. This is the boundary between components, runes, and Capacitor's Preferences API.

This contract is internal to Prowl. It is not a public API. Components import these types and stores; the Svelte runes enforce reactivity.

## State Modules

All state is exposed as Svelte 5 runes (`$state`, `$derived`). State modules are plain `.svelte.ts` files that export rune-backed values.

### `space.svelte.ts` — Active Space

```typescript
// Persistent: stored in Capacitor Preferences as 'active_space_id'.
// Ephemeral: list of all known spaces.

interface SpaceState {
  spaces: Space[];                          // $state — full list, populated from GET /spaces
  active: Space | null;                     // $derived — picked from `spaces` by activeId
  activeId: string | null;                  // $state — null until first load or restore
  isLoading: boolean;                       // $state
  error: string | null;                     // $state

  load(): Promise<void>;                    // Fetches /spaces, restores activeId from Preferences
  setActive(spaceId: string): Promise<void>; // Updates state + persists to Preferences
}
```

**Persistence**: `activeId` is written to Capacitor Preferences on `setActive`. On `load`, it is read back and matched against the live list. If the persisted value no longer exists in sbtask, falls back to `is_default: true` or the first space.

### `tasks.svelte.ts` — Task List Cache

```typescript
interface TasksState {
  byId: Record<string, Task>;               // $state — id → Task
  ids: string[];                            // $state — order is determined by sort/filter
  sort: SortMode;                           // $state — current sort selection
  isLoading: boolean;                       // $state
  lastError: string | null;                 // $state
  lastFetchedAt: number | null;             // $state — epoch ms

  loadInbox(): Promise<void>;               // GET /inbox
  loadToday(): Promise<void>;               // GET /today (stores in a separate map)
  refresh(): Promise<void>;                 // re-runs the current view's loader
  markDone(id: string): Promise<void>;      // POST /done, optimistic update
  undoDone(id: string): Promise<void>;      // POST /undo
  create(input: NewTaskInput): Promise<Task>; // POST /tasks, optimistic insert
  update(id: string, patch: Partial<Task>): Promise<void>; // PATCH /tasks/{id}
  remove(id: string): Promise<void>;        // DELETE /tasks/{id}
}
```

**Optimistic updates**: `markDone`, `undoDone`, `create`, `update`, and `remove` apply the change locally first, then issue the network call. On failure, the previous state is restored and an error is surfaced.

**Today section**: Today tasks are kept in a sibling structure (`today: { overdue, due_today, scheduled_today }`) so the inbox and today views don't share indexes.

### `service.svelte.ts` — Service Health

```typescript
type ServiceState = 'starting' | 'running' | 'unhealthy' | 'restarting' | 'failed';

interface ServiceHealth {
  state: ServiceState;                      // $state
  lastOkAt: number | null;                  // $state — epoch ms
  restartCount: number;                     // $state
  lastError: string | null;                 // $state
}
```

This state is updated by listeners on the `sbtask-ios` Capacitor plugin (`serviceStateChanged` event) and by the polling logic inside the plugin itself. The Svelte layer does not poll; it only observes.

### `sort.svelte.ts` — Sort Selection (session-only)

```typescript
type SortMode = 'priority-then-date' | 'created-desc' | 'due-asc' | 'alpha-asc';

interface SortState {
  mode: SortMode;                           // $state, default 'priority-then-date'
  setMode(mode: SortMode): void;
}
```

Per the research.md decision, sort preference is session-only and not persisted.

## Component-Level Props (one-way)

Components receive data via Svelte 5 `$props()`. They MUST NOT mutate parent state directly. Mutations go through the state module's exported functions.

```typescript
// Example: TaskRow.svelte
interface TaskRowProps {
  task: Task;
  onMarkDone?: (id: string) => void;        // optional callback
}
```

## Derived Views

Components should compose derived state for display:

```typescript
// Example: Inbox view derives the sorted list from tasks store
const sortedTasks = $derived(
  sortTasks(state.tasks.ids.map(id => state.tasks.byId[id]), state.sort.mode)
);
```

## Event Bus (service health → UI)

The `sbtask-ios` plugin emits a `serviceStateChanged` event. The Svelte layer subscribes once in the root layout and dispatches to `service.svelte.ts`:

```typescript
import { Capacitor } from '@capacitor/core';
import { SbtaskPlugin } from 'sbtask-ios';

SbtaskPlugin.addListener('serviceStateChanged', (event) => {
  serviceState.update(event);
});
```

## Cross-Cutting Constraints

- **No globals** outside the state modules. Components import from `$lib/stores/*`.
- **No direct fetch()** outside `$lib/api/*`. Components call state module functions, which call the API client.
- **Runes only**. No legacy `writable()` / `readable()` from Svelte 4.

## Persistence Boundary

| Persisted (Capacitor Preferences) | In-memory only |
|-----------------------------------|----------------|
| `active_space_id`                 | tasks, spaces, sort, service health |
| (nothing else)                    | (all UI state) |

## Error Surfacing

- Transient errors (network blip): show toast / inline banner; do not block UI.
- Persistent errors (service down for >5s): show full-screen error state with retry.
- Validation errors (empty title, etc.): inline field error; no network call made.
