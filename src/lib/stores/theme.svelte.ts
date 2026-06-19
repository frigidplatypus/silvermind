type Theme = 'system' | 'light' | 'dark';

let current = $state<Theme>('system');

export function getTheme(): Theme { return current; }

export function loadTheme(): void {
  try {
    const saved = localStorage.getItem('silvermind-theme');
    if (saved === 'light' || saved === 'dark') {
      current = saved as Theme;
    }
  } catch { /* noop */ }
  apply();
  // Listen for system changes when in "system" mode
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (current === 'system') apply();
  });
}

export function setTheme(theme: Theme): void {
  current = theme;
  try { localStorage.setItem('silvermind-theme', theme); } catch { /* noop */ }
  apply();
}

function apply(): void {
  const isDark = current === 'dark' || (current === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
}
