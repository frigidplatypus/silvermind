export type OnboardingStep = 'welcome' | 'connect' | 'saving';

let _showModal = $state(false);
let _step = $state<OnboardingStep>('welcome');

export function getShowOnboarding(): boolean {
  return _showModal;
}
export function getOnboardingStep(): OnboardingStep {
  return _step;
}

export function startOnboarding(initialStep: OnboardingStep) {
  _step = initialStep;
  _showModal = true;
}

export function goToStep(step: OnboardingStep) {
  _step = step;
}

export function closeOnboarding() {
  _showModal = false;
}
