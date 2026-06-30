# Data Model: JS-Native Backend

**Feature Branch**: `003-js-native-backend` | **Date**: 2026-06-30

## Entities

### Task

The central entity representing a parsed task line from a SilverBullet page.

```typescript
interface Task {
  page: string;                    // SilverBullet page name (e.g., "Tasks")
  position: number;                // 1-based order within page
  text: string;                    // Display text (sans attributes)
  status: string;                  // "" = active, "x" = done, "waiting", "maybe"
  done: boolean;                   // Derived: status === "x"
  due: string;                     // Raw due value (e.g., '[[Journal/2026-06-30]]')
  due_parsed: { date: string } | null;  // Resolved date for display
  deferred: string;                // Raw deferred value
  deferred_parsed: { date: string } | null;
  name: string;                    // Named reference for dependencies
  priority: string;               // "high", "medium", "low", or ""
  tags: string[];                  // #hashtags extracted from text
  parent: string;                  // Parent task name
  depends_on: string[];           // Task names this depends on
  blocked: boolean;                // Computed: any dependency not done
  recur: string;                   // Recurrence rule (e.g., "daily:1")
  alerts: string[];               // Alert times/dates
  extra_attrs: Record<string, string>;  // Custom [key: val] attributes
}
```

**Source**: Parsed from markdown line `- [status] text [due: "..."] [priority: high] #tag`
**Relationships**: Tasks belong to a page. Tasks can depend on other tasks (by name). Tasks can have a parent task.

### TaskFilter

Query parameters for filtering and sorting tasks.

```typescript
interface TaskFilter {
  status?: string[];               // e.g., ["x", "waiting"]
  page?: string;                   // Filter to specific page
  dueBefore?: string;             // ISO date string
  dueAfter?: string;
  deferredBefore?: string;
  deferredAfter?: string;
  name?: string;                   // Exact name match
  priority?: string;               // "high", "medium", "low"
  tags?: string[];                 // Required tags (AND)
  excludeTags?: string[];          // Tags to exclude
  parent?: string;                 // Filter by parent task
  orphan?: boolean;                // Tasks with no parent
  recur?: boolean;                 // Tasks with recurrence
  overdue?: boolean;               // Due date in past
  textSearch?: string;             // Full-text search
  sortBy?: string;                 // "due", "priority", "page", "text"
  sortOrder?: string;              // "asc" or "desc"
  limit?: number;                  // Max results
  offset?: number;                 // Pagination offset
}
```

### SpaceConfig

A named SilverBullet space with connection details.

```typescript
interface SpaceConfig {
  name: string;                    // e.g., "main", "work"
  url: string;                     // e.g., "https://notes.example.com"
  default_page: string;           // e.g., "Tasks"
  inbox_page: string;              // e.g., "Inbox"
  auth_token?: string;             // Optional Bearer token
}

interface SilvermindConfig {
  spaces: Record<string, SpaceConfig>;
  active_space: string;            // Key into spaces map
}
```

**Persistence**: YAML file (`~/.config/silvermind/config.yaml`) on desktop, app sandbox on mobile, localStorage on web.

### QueryBlock

A saved SLIQ query embedded in a SilverBullet page.

```typescript
interface QueryBlock {
  page: string;                    // Page containing this block
  number: number;                  // 1-based block index on page
  title: string;                   // Human-readable title
  sliq: string;                    // Query expression
  heading?: string;                // Nearest heading above the block
  result_count?: number;           // Last execution result count
}

interface QueryBlockPage {
  page: string;
  blocks: QueryBlock[];
}
```

### SilverBulletPage

A page's content for read-modify-write operations.

```typescript
interface SilverBulletPage {
  content: string;                 // Raw markdown
  lastModified: number;            // Unix timestamp for If-Match header
}
```

## State Transitions

### Task Lifecycle

```
[ ] Create → active (status: "")
  ├─ Toggle done → done (status: "x")
  │   └─ If has recur: create next occurrence, mark current done
  ├─ Set waiting → waiting (status: "waiting")
  ├─ Set maybe → maybe (status: "maybe")
  ├─ Archive → moved under ## Task Archive header
  └─ Delete → removed from page
```

### Config Lifecycle

```
App startup → ReadConfig (from platform bridge)
  ├─ Success → Parse YAML → Cache in memory
  │   └─ No spaces → Show onboarding
  └─ Error / not found → Show onboarding
User action → Modify spaces → WriteConfig (via platform bridge)
  └─ Error → Show error toast
```

## Validation Rules

- Task text must not be empty
- Status must be "", "x", "waiting", or "maybe"
- Date values must pass ParseDate (chrono-node) validation
- Priority must be "high", "medium", "low", or ""
- Recurrence must match `^(daily|weekly|monthly|yearly):\d+$`
- Page names must not contain ".." or backslash
- Space URL must be a valid HTTP(S) URL
- Duplicate space names not allowed
