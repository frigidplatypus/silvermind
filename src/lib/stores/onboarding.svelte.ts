export type OnboardingStep = 'migration' | 'welcome' | 'connect' | 'saving';

let _showModal = $state(false);
let _step = $state<OnboardingStep>('welcome');
let _migrationSpaces = $state<{ name: string; url: string }[]>([]);

export function getShowOnboarding(): boolean { return _showModal; }
export function getOnboardingStep(): OnboardingStep { return _step; }
export function getMigrationSpaces() { return _migrationSpaces; }

export function startOnboarding(initialStep: OnboardingStep, spaces?: { name: string; url: string }[]) {
  _step = initialStep;
  _showModal = true;
  if (spaces) _migrationSpaces = spaces;
}

export function goToStep(step: OnboardingStep) {
  _step = step;
}

export function closeOnboarding() {
  _showModal = false;
}
