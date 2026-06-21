let current = $state<string>('inbox');

const valid = new Set(['inbox', 'today', 'global']);

export function getDefaultView(): string { return current; }

export function loadDefaultView(): void {
  try {
    const saved = localStorage.getItem('silvermind-default-view');
    if (saved && valid.has(saved)) current = saved;
  } catch { /* noop */ }
}

export function setDefaultView(view: string): void {
  if (!valid.has(view)) return;
  current = view;
  try { localStorage.setItem('silvermind-default-view', view); } catch { /* noop */ }
}
