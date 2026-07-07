import type { AccentPreset } from '$lib/themes';
import { getPreset } from '$lib/themes';
import { syncThemeStatusBar } from '$lib/native/status-bar';

export type Mode = 'system' | 'light' | 'dark';

let currentMode = $state<Mode>('system');
let currentAccent = $state<AccentPreset>('ocean');

export function getTheme(): Mode {
  return currentMode;
}
export function getAccent(): AccentPreset {
  return currentAccent;
}

export function loadTheme(): void {
  try {
    const saved = localStorage.getItem('silvermind-theme');
    if (saved === 'light' || saved === 'dark') {
      currentMode = saved as Mode;
    }
  } catch {
    /* noop */
  }
  try {
    const saved = localStorage.getItem('silvermind-accent');
    if (saved) currentAccent = saved as AccentPreset;
  } catch {
    /* noop */
  }
  apply();
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (currentMode === 'system') apply();
  });
}

export function setTheme(mode: Mode): void {
  currentMode = mode;
  try {
    localStorage.setItem('silvermind-theme', mode);
  } catch {
    /* noop */
  }
  apply();
}

export function setAccent(accent: AccentPreset): void {
  currentAccent = accent;
  try {
    localStorage.setItem('silvermind-accent', accent);
  } catch {
    /* noop */
  }
  apply();
}

function apply(): void {
  const isDark =
    currentMode === 'dark' ||
    (currentMode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-accent', currentAccent);

  // Apply accent CSS variables directly for the current mode
  const preset = getPreset(currentAccent);
  const root = document.documentElement.style;
  if (isDark) {
    root.setProperty('--color-accent', preset.accentDark);
    root.setProperty('--color-accent-light', preset.accentLightDark);
  } else {
    root.setProperty('--color-accent', preset.accent);
    root.setProperty('--color-accent-light', preset.accentLight);
  }

  syncThemeStatusBar().catch(() => {});
}
