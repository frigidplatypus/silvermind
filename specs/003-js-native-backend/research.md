# Research: JS-Native Backend (Strip sbtask)

**Feature Branch**: `003-js-native-backend` | **Date**: 2026-06-30

## 1. Natural Language Date Parser

**Decision**: `chrono-node` (npm package, ~800KB)

**Alternatives considered**:
| Library | Pros | Cons | Verdict |
|---------|------|------|---------|
| `chrono-node` | Battle-tested (4k+ stars), supports "tomorrow", "next monday", "in 3 days", i18n | 800KB bundle | **Selected** |
| Custom parser | Tiny, no deps | Rebuild Go's `when` logic — weeks of work, edge cases | Rejected |
| `date-fns` + manual | Familiar if already using date-fns | No NL parsing — can't handle "tomorrow" | Rejected |

**Migration**: Go's `when.Parse(input, time.Now())` → `chrono.parseDate(input, new Date())`. Both return a resolved date. Minor API difference: chrono returns an array of results, take the first.

**Bundle impact**: ~25KB gzipped. Acceptable — Svelte tree-shakes unused locales.

## 2. Mobile HTTP Transport (CORS Bypass)

**Decision**: `@capacitor/http` Capacitor plugin

**Context**: Mobile WebViews (WKWebView on iOS, Android WebView) enforce CORS. SilverBullet likely doesn't send `Access-Control-Allow-Origin` headers. Direct `fetch()` from the WebView would fail with CORS errors.

**Alternatives considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `@capacitor/http` | Native HTTP, no CORS, Capacitor ecosystem | Adds plugin dependency, different API from fetch | **Selected** |
| SilverBullet CORS headers | Clean, works everywhere | Requires SB server config change — not under our control | Rejected |
| Local proxy (new Go binary) | Works | Defeats purpose of removing Go | Rejected |
| `cordova-plugin-advanced-http` | Same concept | Not Capacitor-native, extra abstraction | Rejected |

**Implementation**: Abstract transport in `sb-client.ts`. `platformFetch(url, options)` delegates to:
- Desktop Wails WebView: `window.fetch()` (WebKitGTK — no CORS enforcement)
- Capacitor (iOS/Android): `CapacitorHttp.request({ url, method, headers, data })`
- Browser dev: `window.fetch()` with Vite proxy rewriting

## 3. YAML Config Processing

**Decision**: `js-yaml` (npm package, ~40KB gzipped)

**Context**: Config must be YAML to remain compatible with existing `~/.config/silvermind/config.yaml` files and the flatpak/Nix ecosystem. `js-yaml` is the standard JS YAML parser (20M+ weekly downloads).

**Alternatives considered**:
| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| `js-yaml` | Mature, well-tested, SilverBullet ecosystem uses it | Moderate size | **Selected** |
| JSON config | Browser-native, no parser needed | Breaks existing config files, not Wails-native convention | Rejected |
| Custom YAML parser | Tiny | Rebuild a spec-compliant YAML parser | Rejected |

**Config format** (unchanged):
```yaml
spaces:
  main:
    space: "https://notes.example.com"
    default_page: "Tasks"
    inbox_page: "Inbox"
active_space: "main"
```

## 4. Atomic Page Writes (If-Match / ReadModifyWrite)

**Decision**: Implement in TypeScript with retry loop

**Context**: Go's `ReadModifyWrite` does: read page → call modify function → write with `If-Match` header → if 412, retry (up to 10x). TS implementation does the same with `fetch()`.

**No external dependency needed** — plain `fetch()` with custom headers.

**Retry strategy**: 3 retries (reduced from Go's 10 — on mobile, 10 retries on a slow connection could take minutes). Each retry re-reads the page to get the latest version.

## 5. Wiki Link Rendering (FormatWikiLinks)

**Decision**: Regex replacement in TS — no external library needed

**Context**: SilverBullet wiki links are `[[Page Name]]` or `[[Journal/2026-06-30]]`. The existing Go code converts them to `<a href="spaceURL/Page%20Name">Page Name</a>`. Same regex logic in TS.

**No new dependency** — standard `String.replace()` with regex.

## 6. SLIQ Query Parser

**Decision**: Port Go's custom parser to TypeScript

**Context**: SLIQ is sbtask's custom query language (not a standard). There's no off-the-shelf JS parser for it. The parser is ~450 lines of Go — straightforward string manipulation and regex.

**No external dependency** — custom TypeScript parser matching Go behavior exactly.

**Key SLIQ syntax elements to port**:
```
status == "x"                    → TaskFilter.Status = ["x"]
due < "2026-01-01"              → TaskFilter.DueBefore
has #tag                        → TaskFilter.Tags
overdue                         → post-filter function
blocked                         → post-filter function
sort due asc                    → TaskFilter.SortBy/SortOrder
limit 50                        → TaskFilter.Limit
```

## 7. SilverBullet API Compatibility

**Decision**: Use same endpoints, same request/response format

**No change to SilverBullet API**. The TS client calls the same endpoints:
- `GET /.fs/<page>` — read page
- `PUT /.fs/<page>` — write page
- `GET /.runtime/objects/task` — query tasks
- `GET /.runtime/objects/task/<ref>` — get task
- `GET /.runtime/objects/page` — find pages

Request/response format unchanged. Go's `client.Client` becomes a TypeScript class with `fetch()`-based methods.

## 8. Wails Bridge Design

**Decision**: Minimal Go surface — config file I/O + notifications only

**Current Go layer** (~400 lines): HTTP server, config manager, Sentry, sbtask process wrapper
**New Go layer** (~60 lines): ReadConfig, WriteConfig, NotifyAlert, GetPlatform

**Rationale**: Wails can only bridge Go ↔ JS. File I/O requires OS access (`os.ReadFile`, `os.WriteFile`). Notifications require `notify-send` exec. Everything else (task logic, queries, SB client) runs in TypeScript.

## Summary of New Dependencies

| Package | Purpose | Size (gzipped) |
|---------|---------|----------------|
| `chrono-node` | Natural language date parsing | ~25KB |
| `@capacitor/http` | Native HTTP on mobile (CORS bypass) | Plugin, no bundle cost |
| `@capacitor/filesystem` | File I/O for mobile config | Plugin, no bundle cost |
| `js-yaml` | YAML config parse/stringify | ~40KB |
| **Total new JS** | ~1700 lines TypeScript | N/A |
| **Deleted Go** | ~5000 lines + 13-14MB binary | -14MB mobile bundle |

## Rejected Approaches

1. **Keep Go backend, only change mobile**: Would keep the CLI but double the maintenance burden (Go + TS versions of task logic). Rejected per user preference.
2. **Use gomobile for iOS**: Would add gomobile framework complexity without eliminating Go. Rejected — same subprocess problems.
3. **Node.js server for desktop**: Would add a Node.js runtime dependency to the Flatpak/Nix build. Rejected — Wails already provides a WebView runtime.
