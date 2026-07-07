# Silvermind

**Silvermind** is a cross-platform task app for [SilverBullet](https://silverbullet.md).
It uses a Svelte 5 frontend with a native-feeling desktop shell and talks directly to
SilverBullet pages and runtime APIs. `sbtask` is no longer part of the application
architecture.

## Current Status

- JS-native backend: task CRUD, inbox loading, today view, query execution, and config
  management all run from the app code in this repo.
- Desktop app: Linux desktop shell via Wails.
- Mobile app: Capacitor-based iOS and Android projects are present in the repo.
- SilverBullet integration: direct reads and writes to SilverBullet pages plus runtime API
  queries when available.
- Query support: Silvermind can build, save, discover, and execute tagged SilverBullet
  task queries.

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                    Svelte 5 UI (src/)                       │
│ Inbox · Today · Global · Queries · Builder · Settings       │
│ Quick capture · Task detail/editor · Desktop/mobile shells  │
└─────────────────────────────┬────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│            TypeScript backend logic (src/lib/backend)       │
│ SilverBullet client · task ops · inbox loading · queries    │
│ config manager · parser/serializer · today/query engines    │
└───────────────┬──────────────────────────────┬───────────────┘
                │                              │
                ▼                              ▼
┌──────────────────────────────┐   ┌──────────────────────────┐
│ SilverBullet .fs page access │   │ SilverBullet runtime API │
│ read/write markdown pages    │   │ tasks/pages/tags lookup  │
└──────────────────────────────┘   └──────────────────────────┘

Desktop shell:
- Wails app embeds the built frontend
- Go layer provides config storage, URL opening, and proxy fetch helpers

Mobile shell:
- Capacitor wraps the same frontend
- Native plugins provide filesystem, haptics, status bar, splash, and HTTP
```

## What Changed

Silvermind used to rely on `sbtask` as a separate backend/service layer.
That is no longer true.

Now:

- task reads come from SilverBullet runtime APIs when possible, with page-based fallback
- task mutations edit SilverBullet markdown directly
- saved query pages are SilverBullet pages tagged with `silvermind/queries`
- desktop config is managed by Silvermind itself in `~/.config/silvermind/config.yaml`

## Prerequisites

### Runtime

- A running SilverBullet instance
- An auth token for that SilverBullet space

### Development

- Nix with flakes enabled
- Go
- Node.js 22
- pnpm
- WebKitGTK 4.1, GTK3, and pkg-config for Linux desktop builds
- Xcode for iOS work
- Android SDK / Gradle for Android work

Use the Nix shell unless explicitly working outside it:

```bash
nix develop
```

The flake shell also enables the repository hooks from `.githooks` automatically.

## Project Structure

```text
├── src/
│   ├── routes/
│   │   ├── +layout.svelte
│   │   ├── inbox/
│   │   ├── today/
│   │   ├── global/
│   │   ├── queries/
│   │   ├── builder/
│   │   └── settings/
│   └── lib/
│       ├── api/           # frontend-facing task/query/today/space APIs
│       ├── backend/       # SilverBullet client, task ops, query engine, parsers
│       ├── components/    # app UI components
│       ├── helpers/       # logging, task actions, etc.
│       ├── native/        # Capacitor wrappers
│       ├── stores/        # Svelte state stores
│       ├── types/         # shared frontend types
│       └── desktop-bridge.ts
├── desktop/
│   ├── main.go           # Wails entry point + bindings
│   ├── config.go         # desktop config persistence
│   └── frontend/dist/    # checked-in desktop frontend bundle
├── android-plugin/       # Android helper/plugin code
├── scripts/
├── flake.nix
├── Justfile
└── specs/
```

## Configuration

Silvermind stores its config in:

- Desktop: `~/.config/silvermind/config.yaml`
- Capacitor platforms: app-managed storage/filesystem

Config shape:

```yaml
spaces:
  my-space:
    space: https://your-silverbullet-instance.example.com
    auth_token: your-auth-token
    default_page: Tasks
    inbox_page: Inbox
active_space: my-space
```

The example file in this repo is `silvermind-config.example.yaml`, but the active Silvermind
desktop config path is `~/.config/silvermind/config.yaml`.

## Query Pages

Saved Silvermind query pages are regular SilverBullet pages.

- They are tagged with `silvermind/queries`
- A single tagged page can contain multiple query blocks
- Task-list queries should render with `select templates.taskItem(...)`

Silvermind uses these pages for the Queries sidebar and the query results views.

## Quick Start

### Desktop app

Build and run the Linux desktop binary:

```bash
nix develop
just run
```

Or build only:

```bash
nix develop
just build
```

### Web/dev UI

```bash
nix develop
pnpm dev
```

### iOS

```bash
nix develop
pnpm cap:sync
pnpm cap:open
```

### Android

```bash
nix develop .#android
just build-android
just cap-open-android
```

## Development Workflows

### Recommended desktop workflow

```bash
nix develop
just dist
just build-go
./desktop/silvermind-desktop
```

### Frontend-only workflow

```bash
nix develop
pnpm dev
```

### Useful `just` commands

- `just dist` - build desktop frontend bundle
- `just build` - build full desktop app
- `just run` - build and run desktop app
- `just dist-mobile` - build mobile/browser frontend
- `just build-android` - prepare Android app assets and sync
- `just cap-open` - open iOS project
- `just cap-open-android` - open Android project

## Build Commands

| Command                 | Output                       | Description                |
| ----------------------- | ---------------------------- | -------------------------- |
| `pnpm build`            | `dist/`                      | main frontend build        |
| `pnpm build:desktop`    | `desktop/frontend/dist/`     | desktop frontend bundle    |
| `pnpm build:web`        | `frontend/dist/`             | standalone web GUI bundle  |
| `just build`            | `desktop/silvermind-desktop` | desktop binary             |
| `pnpm cap:sync`         | `ios/`                       | sync iOS Capacitor app     |
| `pnpm cap:sync:android` | `android/`                   | sync Android Capacitor app |

`desktop/frontend/dist/` is checked into git so the Wails desktop build can embed a known
frontend bundle.

## Desktop Integration

The Go desktop layer is intentionally thin.

It currently handles:

- config file persistence
- opening external URLs via `xdg-open`
- HTTP proxy fetch support for desktop environments where direct browser fetch is unreliable
- embedding and serving the built frontend bundle

It does not host a task server.

## SilverBullet Integration Notes

Silvermind talks to SilverBullet in two ways:

- `/.runtime/objects/...` for fast task/page/tag lookups when the runtime API is healthy
- `/.fs/...` for direct markdown page reads and writes

When runtime APIs fail, some paths fall back to page-based loading.

## Troubleshooting

### Queries page is empty

Make sure:

- the SilverBullet page is tagged with `silvermind/queries`
- the page contains valid task-list query blocks
- the SilverBullet runtime object API is healthy enough to enumerate tagged pages

### Desktop build is missing embedded frontend assets

Run:

```bash
nix develop
just dist
```

before `just build` or `go build` in `desktop/`.

### SilverBullet calls time out

Verify:

- the configured space URL is correct
- the auth token is valid
- the SilverBullet runtime API is enabled and healthy

### External links do not open on desktop

Desktop link opening uses the Wails Go bridge and `xdg-open`.

## Keyboard Shortcuts

Current desktop shortcuts include:

- `Ctrl+N` - focus quick capture
- `Ctrl+1` - inbox
- `Ctrl+2` - today
- `Ctrl+,` - settings

## License

MIT
