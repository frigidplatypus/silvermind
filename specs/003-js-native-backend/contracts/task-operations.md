# Contract: Task Operations

**Modules**: `src/lib/backend/task-parser.ts`, `src/lib/backend/task-serializer.ts`, `src/lib/backend/task-operations.ts`, `src/lib/backend/inbox-operations.ts`

## Task Parser

```typescript
function parseTaskLine(line: string): Task | null
```
- Input: raw markdown line. Output: parsed Task or null if not a task line.
- Matches regex: `/^[\s]*[-*]\s*\[([^\]]*)\]\s*(.*)$/`
- Extracts attributes via regex: `/\[(\w+):\s*((?:"[^"]*")|(?:[^]]+))\]/`
- Known attributes: due, deferred, name, priority, dependsOn, recur, alerts
- Unknown attributes go to `extra_attrs`
- Tags extracted via `/#([\w-]+(?:\/[\w-]+)*)/g`

```typescript
function parseTasksFromPage(content: string, page: string): Task[]
```
- Splits page into lines, parses each, assigns incremental position

```typescript
function extractTags(text: string): string[]
```

## Task Serializer

```typescript
function toMarkdown(task: Task): string
```
- Produces: `- [{status}] {text} [due: "..."] [priority: high] ...`
- Attributes sorted alphabetically (stable output for diffs)
- Empty status becomes " " (active)

```typescript
function formatWikiLinks(text: string, spaceURL: string): string
```
- Converts `[[Page]]` to `<a href="{spaceURL}/{Page}">{name}</a>`
- For task display in the UI

```typescript
function formatJournalLink(date: string, time?: string): string
```
- Produces: `[[Journal/2026-06-30]]` or `[[Journal/2026-06-30]] 14:00`

```typescript
function parseJournalLink(value: string): { date: string; time?: string } | null
```

## Task Operations

```typescript
function toggleDone(task: Task, sbClient: SbClient): Promise<Task>
```
- Sets status to "x", marks done. If recurrence, creates next occurrence.
- Uses ReadModifyWrite to atomically update the page.

```typescript
function toggleUndone(task: Task, sbClient: SbClient): Promise<Task>
```
- Sets status to " " (active), done=false.

```typescript
function modifyTask(task: Task, fields: Partial<Task>, sbClient: SbClient): Promise<Task>
```

```typescript
function deleteTask(task: Task, sbClient: SbClient): Promise<void>
```

```typescript
function archiveTasks(page: string, sbClient: SbClient): Promise<{ archived: number }>
```
- Finds all `- [x]` lines, moves under `## Task Archive` header.
- Idempotent: already-archived tasks are not moved again.

```typescript
function createTask(input: CreateTaskInput, sbClient: SbClient): Promise<Task>
```
- Appends task line to the configured inbox page.
- If page doesn't exist, creates it.

## Today Operations

```typescript
function getToday(sbClient: SbClient): Promise<{
  overdue: Task[];
  dueToday: Task[];
  deferredToday: Task[];
}>
```
- Queries all tasks, computes overdue (due < today), due today, deferred today.
- Excludes done and waiting tasks.

## Edge Cases

- Empty page → parseTasksFromPage returns []
- Task line with only attributes (no text) → parseTaskLine returns null
- Double-quoted attribute values → unquoted on parse (e.g., `[due: "2026-01-01"]` → due="2026-01-01")
- Recurrence on completion → next task has same text, tags, priority; only due/date advances
- Archive on page with no done tasks → returns { archived: 0 }, page unchanged
