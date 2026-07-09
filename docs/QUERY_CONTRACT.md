# Silvermind Query Contract

**Version**: 1.0  
**Last Updated**: 2026-07-09

---

## Core Principle

> **"Queries execute everywhere; Silvermind adds personalized filtering."**

Every SLIQ query written in Silvermind is valid SilverBullet SLIQ and executes identically across all environments. Silvermind applies additional personalized post-filters that are specific to each user's configuration and context.

---

## What This Means

| Environment             | Query Execution                     | Post-Filters Applied        |
| ----------------------- | ----------------------------------- | --------------------------- |
| **SilverBullet Web UI** | ✅ Full SLIQ runtime                | ❌ None (raw results)       |
| **Silvermind Desktop**  | ✅ Full SLIQ runtime (via Go proxy) | ✅ All personalized filters |
| **Silvermind Mobile**   | ✅ Full SLIQ runtime (Capacitor)    | ✅ All personalized filters |

**The same query produces the same base result set everywhere.** Differences only appear due to Silvermind's user-specific post-filters.

---

## Silvermind Post-Filters (Client-Side Only)

Silvermind applies these filters **after** receiving results from the SilverBullet runtime. They are not pushed to the server and do not affect SilverBullet's native query execution.

### 1. Hard Exclusions (Always Applied)

| Filter            | Logic                             |
| ----------------- | --------------------------------- |
| Completed tasks   | `status == 'x'` or `done == true` |
| Waiting tasks     | `status == 'waiting'`             |
| Library pages     | `page.startsWith('Library/')`     |
| Meta-tagged pages | Page has tag `meta` or `meta/*`   |

_Defined in `query-operations.ts:applyHardExclusions()`_

### 2. User-Configured Tag Exclusions

| Source       | Key            | Description                          |
| ------------ | -------------- | ------------------------------------ |
| Space config | `exclude_tags` | Array of tags to hide from all views |

_Loaded from `Library/Silvermind/config` on space switch; applied in `filterExcludeTags()`_

### 3. Global Page Exclusions (Async)

| Logic                  | Description                                    |
| ---------------------- | ---------------------------------------------- |
| Check each task's page | Fetches page content via `sbClient.readPage()` |
| Exclude if page has    | Tag `meta` or `meta/*`                         |

_Implemented in `applyGlobalTaskExclusions()` — runs async after runtime query_

### 4. Default View Exclusions (Async)

| Logic                 | Description                                       |
| --------------------- | ------------------------------------------------- |
| Config `exclude_tags` | Compared against task's page tags (not task tags) |
| Page-level            | If task's page has excluded tag, hide the task    |

_Used by "Today" and "All Tasks" views; runs in `applyDefaultViewExclusions()`_

---

## Post-Filter Application Order

```
Runtime Query Results
    │
    ▼
applyHardExclusions()           // synchronous
    │
    ▼
filterExcludeTags()             // synchronous (config exclude_tags)
    │
    ▼
applyGlobalTaskExclusions()     // async (page meta tags)
    │
    ▼
applyDefaultViewExclusions()    // async (page exclude_tags)
    │
    ▼
Final Result Set
```

---

## Writing Portable Queries

### ✅ Do

- Use standard SLIQ syntax (see [SilverBullet SLIQ docs](https://silverbullet.md/Space%20Lua/Integrated%20Query))
- Test queries in SilverBullet web UI first
- Use standard field names: `due`, `deferred`, `priority`, `tags`, `page`, `name`, `status`, `done`

### ❌ Don't

- Don't rely on Silvermind-specific keywords (none exist after v1 cleanup)
- Don't embed post-filter logic in SLIQ (e.g., don't try to exclude `meta` pages in SLIQ)
- Don't assume result count will match between SilverBullet and Silvermind

### Example Portable Query

```sliq
from t = index.objects("task")
where not t.done
  and table.includes(t.itags, "work")
  and t.due < today()
order by t.due asc
limit 50
```

This runs identically in SilverBullet, Silvermind Desktop, and Silvermind Mobile.

---

## Result Expectations

| Scenario                           | SilverBullet Web | Silvermind               |
| ---------------------------------- | ---------------- | ------------------------ |
| Query returns 10 tasks             | 10 tasks         | ≤10 tasks (post-filters) |
| Task on `Library/Templates`        | Visible          | Hidden (hard exclusion)  |
| Task tagged `#later` (excluded)    | Visible          | Hidden (config)          |
| Task on page tagged `meta/project` | Visible          | Hidden (async check)     |

---

## Future Extensions

### When SilverBullet Runtime Supports:

| Feature              | Silvermind Adoption                           |
| -------------------- | --------------------------------------------- |
| `t.blocked` field    | Push `blocked`/`unblocked` filters to runtime |
| Cross-task joins     | Native dependency/blocking queries            |
| `today()` in runtime | Push `overdue` filter to server               |

Silvermind will automatically push compatible filters to the runtime when available, reducing client-side post-filtering.

---

## Debugging

### Development Mode

Set `localStorage.setItem('silvermind:debug', 'true')` to see:

```
[Silvermind] Query executed; post-filters: hard_exclusions, exclude_tags, global_exclusions, default_view_exclusions
```

### Inspecting Post-Filters

In browser devtools / desktop console:

```javascript
// See what filters are applied
console.log('exclude_tags:', spaceConfig.exclude_tags);
console.log('hard exclusions applied:', tasks.length);
```

---

## Related Documentation

- [SilverBullet SLIQ Reference](https://silverbullet.md/Space%20Lua/Integrated%20Query)
- [Space Config Format](../specs/003-js-native-backend/data-model.md)
- [Query Engine API](../src/lib/backend/query-operations.ts)
- [Task Types](../src/lib/backend/task-types.ts)

---

## Version History

| Version | Date       | Changes                                                               |
| ------- | ---------- | --------------------------------------------------------------------- |
| 1.0     | 2026-07-09 | Initial contract: queries execute everywhere; post-filters documented |
