# Silvermind

**Silvermind** is a task management application that wraps the [sbtask](https://git.fluffy-rooster.ts.net/FRGD/sbtask) CLI tool with a native-feeling Svelte 5 web UI. It runs on **iOS** (via Capacitor) and **Linux desktop** (via Wails v2) from a single TypeScript/Svelte codebase.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   Svelte 5 UI (src/)                 │
│  Inbox · Today · Settings · Quick Capture · Sidebar  │
│  Task detail · Task editor · Markdown · Space switch │
└─────────────┬───────────────────────┬────────────────┘
              │ HTTP (localhost:7433) │
              ▼                       ▼
┌─────────────────────┐   ┌──────────────────────────┐
│  Vite dev server    │   │  Wails v2 (Go binary)    │
│  (browser + mobile) │   │  embeds sbtask as lib    │
│  proxies /api→7433  │   │  starts serve in-process │
└─────────────────────┘   └──────┬───────────────────┘
                                 │ Go module replace
                                 ▼
                    ┌────────────────────────┐
                    │  sbtask (pkg/serve)    │
                    │  REST API on :7433     │
                    │  reads config.yaml     │
                    └────────────────────────┘
```

### Mobile (iOS)
- **Capacitor 6** wraps the Vite-built web app in a native WKWebView
- `sbtask` runs as a **separate process** (spawned by the iOS app)
- The Vite dev server proxies `/api` → `localhost:7433`
- Capacitor plugins: Haptics, Preferences, Splash Screen, Status Bar

### Desktop (Linux)
- **Wails v2** wraps the Vite-built web app in a WebKitGTK webview
- `sbtask` runs **in-process** as a Go library via `go.mod replace`
- The Go binary embeds `desktop/frontend/dist/` at compile time via `go:embed`
- Go AppService methods (`ListSpaces`, `AddSpace`, `SetActiveSpace`, etc.) are bridged to the frontend via `window.go.main.App.*`

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Go | 1.26+ | |
| Node.js | 22 | |
| pnpm | latest | |
| sbtask | latest | local checkout at `~/development/go/sbtask` |
| WebKitGTK | 4.1 | desktop only |
| GTK3 | — | desktop only |
| pkg-config | — | desktop only |
| Xcode | latest | iOS only |
| CocoaPods | — | iOS only |
| Capacitor CLI | 6.x | iOS only |

---

## Project Structure

```
├── src/
│   ├── main.ts                    # App entry point (hash-based SPA router)
│   ├── app.css                    # CSS variables, reset, theme (light/dark)
│   ├── index.html                 # HTML shell
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts          # HTTP client (auto-detects Wails/browser)
│   │   │   ├── inbox.ts           # GET /tasks → filter active
│   │   │   ├── today.ts           # GET /today
│   │   │   ├── tasks.ts           # CRUD for tasks
│   │   │   └── spaces.ts          # GET /spaces
│   │   ├── components/
│   │   │   ├── Autocomplete.svelte
│   │   │   ├── DesktopShell.svelte # Desktop layout (sidebar + split pane)
│   │   │   ├── Icon.svelte        # Feather Icons wrapper
│   │   │   ├── Markdown.svelte    # Markdown renderer (links open in browser)
│   │   │   ├── QuickCapture.svelte
│   │   │   ├── Sidebar.svelte     # Desktop sidebar nav + space switcher
│   │   │   ├── SpaceSwitcher.svelte
│   │   │   ├── SplitPane.svelte   # Collapsible resizable right pane
│   │   │   ├── TaskDetail.svelte  # overlay (mobile) / panel (desktop)
│   │   │   ├── TaskEditor.svelte  # fullscreen (mobile) / modal (desktop)
│   │   │   ├── TaskList.svelte    # List with pull-to-refresh, error state
│   │   │   └── TaskRow.svelte     # Single task row
│   │   ├── native/
│   │   │   ├── haptics.ts         # Capacitor Haptics wrapper (graceful no-op)
│   │   │   ├── splash.ts          # Capacitor SplashScreen wrapper
│   │   │   └── status-bar.ts      # Capacitor StatusBar wrapper
│   │   ├── stores/
│   │   │   ├── desktop.svelte.ts  # Desktop state (split ratio, selected task)
│   │   │   ├── service.svelte.ts  # sbtask server health
│   │   │   ├── privacy.svelte.ts  # Crash reporting consent
│   │   │   ├── space.svelte.ts    # Spaces from API + localStorage
│   │   │   ├── tasknames.svelte.ts# Task names for autocomplete
│   │   │   ├── tasks.svelte.ts    # Inbox/today tasks, error formatting
│   │   │   └── theme.svelte.ts    # system/light/dark
│   │   ├── types/
│   │   │   ├── task.ts
│   │   │   ├── space.ts
│   │   │   ├── service.ts
│   │   │   └── sort.ts
│   │   ├── desktop-bridge.ts      # Typed Wails Go method wrappers
│   │   └── router.ts              # Hash-based SPA router (#/inbox, #/today)
│   └── routes/
│       ├── +layout.svelte         # Root layout (mobile/desktop switch at 800px)
│       ├── inbox/+page.svelte
│       ├── today/+page.svelte
│       └── settings/+page.svelte
├── desktop/
│   ├── main.go                    # Wails app entry, AppService methods
│   ├── sbtask.go                  # sbtask in-process server wrapper
│   ├── config.go                  # Config CRUD with migration from sbtask
│   ├── wails.json                 # Wails project config
│   └── frontend/dist/             # Pre-built frontend (checked into git)
├── specs/
│   ├── 001-silvermind-mobile-app/ # Original mobile app spec
│   └── 002-desktop-layout/        # Desktop wrapper spec & plan
├── scripts/
│   └── fetch-sbtask.sh            # Cross-compile sbtask for iOS arm64
├── ios/                           # Capacitor iOS project (gitignored)
├── flake.nix                      # Nix flake: builds silvermind-desktop
├── devenv.nix                     # devenv.sh: sbtask + vite dev
├── vite.config.ts                 # Vite config (mobile/browser dev)
├── vite.config.desktop.ts         # Vite config (desktop build, excludes Capacitor)
├── package.json
├── svelte.config.js               # Svelte 5 runes mode
└── tsconfig.json
```

---

## Quick Start (Alpha Testers)

### 1. Download

Grab the latest binary or APK from [Releases](https://git.fluffy-rooster.ts.net/FRGD/Silvermind/releases).

### 2. Configure your spaces

Copy the example config to its expected location:

```bash
mkdir -p ~/.config/sbtask
cp sbtask-config.example.yaml ~/.config/sbtask/config.yaml
# Edit the file with your SilverBullet URL and auth token
```

Or run the interactive config generator:

```bash
sbtask config init
```

### 3. Start the server

**Desktop (Linux/macOS):**
```bash
sbtask serve --web-gui frontend/dist
# Open http://localhost:9876
```

**Android:** Install the APK and launch Silvermind from your app drawer.
The app automatically starts the sbtask service on the device.

### System Requirements

- 64-bit Linux, macOS, or Android 10+
- A running [SilverBullet](https://silverbullet.md) instance with the runtime-api Docker variant
- Your SilverBullet auth token (found in your SilverBullet config)

---

## Getting Started (Development)

### Web Development (browser + Vite proxy)

```bash
# Start sbtask server
sbtask serve --port 7433

# In another terminal, start Vite dev server
pnpm dev
# → http://localhost:5173 (proxies /api → :7433)
```

### Desktop Development (Wails + Vite)

Use the devenv shell:

```bash
devenv shell
devenv up
# Starts sbtask serve + Vite dev server
# For the actual desktop binary:
build-desktop
```

Or manually:

```bash
# Terminal 1: sbtask backend
sbtask serve --port 7433

# Terminal 2: Vite dev for frontend
pnpm dev

# Terminal 3: build Go binary
cd desktop
CGO_ENABLED=1 CGO_CFLAGS="-Wno-error=incompatible-pointer-types" \
  go build -tags "desktop production webkit2_41" -ldflags="-s -w" -o silvermind-desktop .
./silvermind-desktop
```

### iOS Development

```bash
# Build sbtask for iOS arm64
pnpm sbtask:fetch

# Sync Capacitor
pnpm cap:sync

# Open Xcode
pnpm cap:open
# Build and run on device/simulator from Xcode
```

---

## Build Commands

| Command | Output | Description |
|---------|--------|-------------|
| `pnpm build` | `dist/` | Mobile/browser build |
| `pnpm build:desktop` | `desktop/frontend/dist/` | Desktop frontend build (excludes Capacitor) |
| `go build` (in `desktop/`) | `silvermind-desktop` | Desktop Go binary (embeds dist/) |
| `pnpm sbtask:fetch` | `ios/App/sbtask` | Cross-compile sbtask for iOS arm64 |
| `pnpm cap:sync` | ios/ | Sync Capacitor iOS project |
| `pnpm cap:open` | — | Open iOS project in Xcode |

**Important**: Run `pnpm build:desktop` before `go build` to ensure `desktop/frontend/dist/` has fresh assets. This directory is checked into git so `go build` works in CI without Node.js.

---

## Configuration

### Config file path

| Platform | Path |
|----------|------|
| Desktop | `~/.config/silvermind/config.yaml` |
| iOS | App sandbox (managed by sbtask) |

### Format

```yaml
spaces:
  main:
    space: http://localhost:3000
    default_page: Tasks
    inbox_page: Inbox
active_space: main
```

On first run, Silvermind **migrates** from `~/.config/sbtask/config.yaml` if the Silvermind config doesn't exist yet (skips bare default configs with only a `main`→`localhost:3000` space).

### Managing spaces

Spaces can be managed from the **Settings** page in the app (desktop only for add/edit/remove) or by editing the YAML file directly.

---

## Theme

Three themes supported: `system` (follow OS), `light`, `dark`. Stored in `localStorage` as `silvermind-theme`. Dark mode uses a deep navy palette (`#1a1a2e` background).

CSS custom properties are defined in `src/app.css` with `[data-theme="dark"]` overrides and `prefers-reduced-motion` support.

---

## Key Design Decisions

1. **Single codebase** — Same `src/` tree for mobile and desktop. Responsive layout at 800px breakpoint switches between mobile tab-bar layout and desktop sidebar+split-pane layout.

2. **sbtask as library** — Desktop embeds sbtask in-process via `go.mod replace`. Mobile spawns sbtask as a separate process.

3. **Frontend dist checked into git** — `desktop/frontend/dist/` is committed so `go build` works in Nix CI without pnpm/Node.js.

4. **No authentication** — All API calls are to localhost.

5. **Feather Icons** — Never emoji. All icons from `feather-icons` package via `Icon.svelte`.

6. **Wails v2** — Only v2 available in nixpkgs. Uses `webkit2_41` build tag.

7. **Visual feedback** — Toast notifications for success, error, and undo actions. Haptics provide complementary physical feedback on supported platforms.

8. **External links** — All `<a>` links in Markdown and elsewhere open in the system default browser. Desktop uses `xdg-open` via Go bridge; mobile uses `window.open(_blank)`.

---

## API Endpoints

Silvermind communicates with the sbtask server on `localhost:7433`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tasks` | List tasks (with `?space=` and `?limit=` params) |
| POST | `/tasks` | Create task |
| PUT | `/tasks/:page/:position` | Update task |
| PUT | `/tasks/:page/:position/done` | Mark done |
| PUT | `/tasks/:page/:position/undo` | Undo done |
| DELETE | `/tasks/:page/:position` | Delete task |
| GET | `/today` | Today view (overdue, due_today, deferred_today) |
| GET | `/spaces` | List spaces |

In browser dev, the Vite proxy rewrites `/api/*` → `/:1` (strips `/api` prefix).

---

## Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` | Focus quick capture |
| `Ctrl+1` | Go to Inbox |
| `Ctrl+2` | Go to Today |
| `Ctrl+,` | Go to Settings |

---

## Accessibility

- Semantic HTML with ARIA roles throughout
- VoiceOver-friendly labels on buttons and controls
- Dynamic Type support (font-size respects system settings via `-webkit-text-size-adjust`)
- Reduced motion respected via `prefers-reduced-motion` media query
- Keyboard navigable (tab stops, arrow keys in autocomplete)

---

## Troubleshooting

### Desktop binary is 16K (frontend assets not embedded)

Run `pnpm build:desktop` first to populate `desktop/frontend/dist/`. This directory is checked into git, so after the first build it persists.

### Space returns 502 / upstream unreachable

The space URL in your config points to a server that isn't running. Verify the URL in `~/.config/silvermind/config.yaml` or the Settings page.

### External links don't open in browser

The link handler tries (in order): `go.main.App.OpenURL` (Wails bridge → `xdg-open`), `window.runtime.BrowserOpenURL` (Wails runtime), `window.open` (browser/Capacitor fallback).

### CORS errors in dev

sbtask serve includes CORS middleware. The Vite proxy also handles this. If running without Vite, ensure the `--cors` flag is set on sbtask serve.

---

## License

MIT
