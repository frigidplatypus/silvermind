# Quickstart: JS-Native Backend

**Feature Branch**: `003-js-native-backend` | **Date**: 2026-06-30

## Prerequisites

- Node.js 22+ with pnpm
- SilverBullet instance accessible via HTTPS
- (Desktop only) Nix with flakes enabled
- (Mobile only) Xcode 16+ (iOS) or Android Studio (Android)

## Quick Test — Browser Dev

```bash
cd silvermind
pnpm install
# Point Vite proxy at your SilverBullet instance
# Edit vite.config.ts to set SB_URL or use env var
pnpm dev
# → http://localhost:5173
```

Navigate to the app. Connect a space. Verify tasks load.

## Quick Test — Desktop (Nix)

```bash
cd silvermind
pnpm build:desktop         # build frontend assets
nix build .#silvermind-desktop
./result/bin/silvermind-desktop
```

## Key Directories (new backend code)

```
src/lib/backend/
├── sb-client.ts          # SilverBullet HTTP client
├── task-types.ts         # Task, TaskFilter interfaces
├── task-parser.ts        # ParseTaskLine, ParseTasksFromPage
├── task-serializer.ts    # ToMarkdown, FormatWikiLinks
├── task-date.ts          # ParseDate, AdvanceDue
├── task-operations.ts    # ToggleDone, ModifyTask, DeleteTask, ArchiveTask
├── inbox-operations.ts   # CreateTask, ReadModifyWrite for inbox
├── today-operations.ts   # GetToday logic
├── space-operations.ts   # ListSpaces, AddSpace, VerifySpace
├── query-engine.ts       # SLIQ parser, filter/sort pipeline
├── query-operations.ts   # QueryPages, QueryExecute, QuerySave
└── config-manager.ts     # Platform-aware YAML config load/save
```

## Key Directories (simplified Go)

```
desktop/
├── main.go    # Wails entrypoint (~60 lines)
└── config.go  # File I/O bridge (~30 lines)
```

## Running Tests

```bash
pnpm vitest src/lib/backend/
```

Key test files (to create):
- `src/lib/backend/__tests__/task-parser.test.ts`
- `src/lib/backend/__tests__/task-serializer.test.ts`
- `src/lib/backend/__tests__/task-date.test.ts`
- `src/lib/backend/__tests__/query-engine.test.ts`
- `src/lib/backend/__tests__/sb-client.test.ts`
- `src/lib/backend/__tests__/inbox-operations.test.ts`

## What Changed From Before

| Before | After |
|--------|-------|
| `pnpm dev` + Go server on :7433 | `pnpm dev` only (Vite proxies SB) |
| `pnpm sbtask:fetch` for iOS | Removed — no Go binary |
| `desktop/go.mod` with `replace` directive | No `replace` — Wails + stdlib only |
| 4 Go files in `desktop/` | 2 Go files (~90 lines total) |
| iOS Capacitor plugin (205 lines Swift) | Simplified to config file I/O only |
| Android Capacitor plugin (269 lines Java) | Simplified to config file I/O only |
| 13-14MB Go binary in mobile bundles | 0MB — no Go binary |
