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

let _showToday = $state(false);

export function getShowToday(): boolean { return _showToday; }

export function loadShowToday(): void {
  try {
    const saved = localStorage.getItem('silvermind-show-today');
    if (saved !== null) _showToday = saved === 'true';
  } catch { /* noop */ }
}

export function setShowToday(v: boolean): void {
  _showToday = v;
  try { localStorage.setItem('silvermind-show-today', String(v)); } catch { /* noop */ }
}
