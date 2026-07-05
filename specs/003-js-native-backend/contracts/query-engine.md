# Contract: Query Engine

**Modules**: `src/lib/backend/query-engine.ts`, `src/lib/backend/query-operations.ts`

## SLIQ Parser

```typescript
function translateSLIQ(sliq: string): { filter: TaskFilter; postFilter: (tasks: Task[]) => Task[] }
```

**SLIQ syntax reference**:

| SLIQ Expression | Behavior |
|----------------|----------|
| `status == "x"` | Filter.Status = ["x"] |
| `status != "waiting"` | Excludes waiting |
| `due < "2026-01-01"` | Filter.DueBefore = "2026-01-01" |
| `due > "2026-01-01"` | Filter.DueAfter = "2026-01-01" |
| `due == "today"` | Due matches today's date |
| `deferred <= "today"` | Deferred on or before today |
| `has #tag` | Filter.Tags includes tag |
| `name == "task-name"` | Filter.Name |
| `priority == "high"` | Filter.Priority |
| `exclude #tag` | Filter.ExcludeTags includes tag |
| `overdue` | Post-filter: due < today |
| `blocked` | Post-filter: blocked === true |
| `unblocked` | Post-filter: blocked === false |
| `orphan` | Filter.Orphan = true |
| `recur` | Filter.Recur = true |
| `parent == "name"` | Filter.Parent |
| `due_after == "2026-06-01"` | Filter.DeferredAfter |
| `sort due asc` | Filter.SortBy = "due", SortOrder = "asc" |
| `sort priority desc` | Filter.SortBy = "priority", SortOrder = "desc" |
| `limit 50` | Filter.Limit = 50 |

**Date function references**:
- `"today"` → resolved to current date
- `"tomorrow"` → today + 1 day
- Relative dates resolved in `resolveRelativeDates()` before parsing

**Default behavior** (no explicit status clause):
- Excludes done (`status === "x"`) and waiting (`status === "waiting"`)
- Applied via `excludeDone()` post-filter

## Query Execution

```typescript
function executeQuery(sliq: string, sbClient: SbClient): Promise<Task[]>
```

Pipeline:
1. Parse SLIQ → `{ filter, postFilter }`
2. Convert filter to API params → `filterToQueryParams(filter)`
3. Fetch from SilverBullet → `sbClient.queryTasks(params)`
4. Convert runtime tasks to Task → `fromRuntime(rt)`
5. Parse extra attributes → `parseExtraAttrs(rt)`
6. Apply post-filters → `postFilter(tasks)`
7. Apply hard exclusions → `applyHardExclusions(tasks)`
8. Compute blocked status → `computeBlocked(tasks)`
9. Normalize positions → `normalizePositions(tasks)`
10. Sort → `sortTasks(tasks, sortBy, order)`
11. Resolve file positions → re-read pages for accurate position numbers

## Filter Functions

```typescript
function filterOverdue(tasks: Task[]): Task[]
function filterByTags(tasks: Task[], required: string[]): Task[]
function filterByStatuses(tasks: Task[], statuses: string[]): Task[]
function filterByParent(tasks: Task[], parent: string): Task[]
function filterByOrphan(tasks: Task[]): Task[]
function filterByRecur(tasks: Task[]): Task[]
function filterExcludeTags(tasks: Task[], exclude: string[]): Task[]
function filterBlocked(tasks: Task[]): Task[]
function filterUnblocked(tasks: Task[]): Task[]
function computeBlocked(tasks: Task[]): void    // mutates in place
function sortTasks(tasks: Task[], sortBy: string, order: string): void
function normalizePositions(tasks: Task[]): void
function applyHardExclusions(tasks: Task[]): Task[]
function excludeDone(tasks: Task[]): Task[]
```

## Query Block Operations

```typescript
function extractQueryBlocks(content: string): QueryBlock[]
```
- Finds SLIQ code fences in markdown

```typescript
function getQueryPages(sbClient: SbClient): Promise<QueryBlockPage[]>
```
- Discovers pages containing query blocks

```typescript
function executeQueryBlock(page: string, blockNumber: number, sbClient: SbClient): Promise<Task[]>
```
- Extracts and executes a specific query block

```typescript
function saveQueryBlock(page: string, blockNumber: number, title: string, sliq: string, sbClient: SbClient): Promise<void>
```

```typescript
function replaceQueryBlock(content: string, blockNumber: number, newTitle: string, newSLIQ: string): string
```
