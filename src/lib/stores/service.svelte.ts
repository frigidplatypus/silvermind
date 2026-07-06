import type { ServiceHealth } from '$lib/types/service';

let stateVal = $state<ServiceHealth>({
  state: 'running',
  lastOkAt: Date.now(),
  restartCount: 0,
  lastError: null,
});

let initialized = false;

export function getServiceState(): ServiceHealth {
  return stateVal;
}

export function updateServiceHealth(health: Partial<ServiceHealth>): void {
  stateVal = { ...stateVal, ...health };
}

export function setServiceState(newState: ServiceHealth['state'], error?: string): void {
  stateVal = {
    ...stateVal,
    state: newState,
    lastError: error ?? null,
    ...(newState === 'running' ? { lastOkAt: Date.now(), restartCount: 0 } : {}),
  };
}

export function initServiceListener(): void {
  if (typeof window === 'undefined') return;
  if (initialized) return;
  initialized = true;

  setServiceState('running');

  // Kept for older development builds; the JS-native backend has no service process.
  window.addEventListener('serviceStateChanged', ((event: CustomEvent) => {
    const payload = event.detail;
    if (payload) {
      updateServiceHealth({
        state: payload.state ?? stateVal.state,
        lastOkAt: payload.lastOkAt ?? null,
        restartCount: payload.restartCount ?? 0,
        lastError: payload.lastError ?? null,
      });
    }
  }) as EventListener);

}
