# Desktop Layout Contract

**Date**: 2026-06-19
**Feature**: [spec.md](../spec.md)

## CSS Breakpoints

| Breakpoint | Layout | Behavior |
|------------|--------|----------|
| >= 800px | Desktop | Sidebar (220px fixed) + main area (split pane) + top bar quick capture |
| < 800px | Mobile | Tab bar (bottom) + single column (no split) + bottom quick capture |

The breakpoint is implemented as a CSS media query on the root layout element. No JavaScript routing or conditional rendering — the same Svelte components render regardless of layout mode.

## Desktop Layout Grid

```
┌──────────┬────────────────────────────────────┐
│ Sidebar  │ Main Area                           │
│ 220px    │ 1fr                                 │
│          │ ┌─────────────────────┬───────────┐ │
│ Inbox    │ │ Quick Capture       │           │ │
│ Today    │ │ (top bar, always)   │           │ │
│ Settings │ ├─────────────────────┤ Detail    │ │
│          │ │ Task List           │ Panel     │ │
│          │ │ (2/3)              │ (1/3)     │ │
│          │ │                     │           │ │
│          │ │ ← drag divider →    │           │ │
│          │ └─────────────────────┴───────────┘ │
│          │ Split Pane (resizable)              │
└──────────┴────────────────────────────────────┘
```

## Component Props

### Sidebar

```typescript
interface SidebarProps {
  activeView: 'inbox' | 'today' | 'settings';
  onNavigate: (view: string) => void;
}
```

### SplitPane

```typescript
interface SplitPaneProps {
  leftPanel: SvelteComponent;   // TaskList
  rightPanel: SvelteComponent;  // TaskDetail or empty
  defaultRatio?: number;         // Default 0.66 (66% left)
  minWidth?: number;            // Minimum 200px per panel
}
```

### DesktopShell

Wraps the entire app in desktop mode. Composes Sidebar + SplitPane + QuickCapture (top bar). Conditionally rendered when `window.innerWidth >= 800`.

```typescript
interface DesktopShellProps {
  // Inherits layout's activeTab for sidebar highlighting
  // Composes child views (Inbox, Today, Settings) internally
}
```

## Keyboard Shortcuts

| Key | Context | Action |
|-----|---------|--------|
| Ctrl+N | Any | Focus quick capture input |
| / | Any (no input focused) | Focus search/filter |
| j | Task list | Move selection down |
| k | Task list | Move selection up |
| Space | Task selected | Toggle done/undo |
| Esc | Detail open | Close detail panel |
| 1-3 | Any | Switch sidebar: 1=Inbox, 2=Today, 3=Settings |

Shortcuts are implemented as a single global `keydown` listener in the root layout, filtered by focus context (no shortcuts fire when `<input>`, `<textarea>`, or `[contenteditable]` is focused, except `/` and Ctrl+N).

## State Management

Desktop layout state lives in a new Svelte rune store:

```typescript
// src/lib/stores/desktop.svelte.ts
let selectedTaskId = $state<string | null>(null);
let splitRatio = $state(0.66);
let isDesktop = $state(false); // updated on resize

export function getSelectedTaskId(): string | null { return selectedTaskId; }
export function setSelectedTaskId(id: string | null): void { selectedTaskId = id; }
export function getSplitRatio(): number { return splitRatio; }
export function setSplitRatio(r: number): void { splitRatio = Math.max(0.2, Math.min(0.8, r)); }
export function getIsDesktop(): boolean { return isDesktop; }
```

## Integration with Existing Code

- `src/routes/+layout.svelte` — added `$effect` that detects `window.innerWidth >= 800` and sets `desktop.isDesktop`. Conditionally renders `DesktopShell` vs existing mobile layout.
- `src/main.ts` — desktop entry imports from `wails runtime` instead of `svelte mount`. Mobile entry unchanged.
- All existing components (`TaskRow`, `TaskList`, `TaskDetail`, `TaskEditor`, `QuickCapture`, etc.) — no changes. They render inside whichever shell is active.
- Native wrappers (`haptics`, `status-bar`, `splash`) — already handle the no-Capacitor case with try/catch.
