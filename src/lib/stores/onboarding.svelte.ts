let _showModal = $state(false);
let _step = $state<'migration' | 'add-space' | 'saving'>('add-space');
let _spaces = $state<{ name: string; url: string }[]>([]);

export function getShowOnboarding(): boolean { return _showModal; }
export function getOnboardingStep() { return _step; }
export function getSbtaskSpaces() { return _spaces; }

export function startOnboarding(step: 'migration' | 'add-space', spaces?: { name: string; url: string }[]) {
  _step = step;
  _showModal = true;
  if (spaces) _spaces = spaces;
}

export function closeOnboarding() {
  _showModal = false;
}
