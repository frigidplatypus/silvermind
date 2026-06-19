import type { ServiceHealth } from '$lib/types/service';

let stateVal = $state<ServiceHealth>({
  state: 'starting',
  lastOkAt: null,
  restartCount: 0,
  lastError: null,
});

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
  if (typeof window !== 'undefined') {
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
}
