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
  if (typeof window === 'undefined') return;

  // Capacitor plugin events (mobile only)
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

  // Fallback health polling for desktop/web (no Capacitor)
  startHealthPolling();
}

let _pollTimer: ReturnType<typeof setInterval> | null = null;

function startHealthPolling() {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch('/api/health', { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        if (stateVal.state !== 'running') setServiceState('running');
      }
    } catch {
      if (stateVal.state === 'running') setServiceState('unhealthy', 'Health check failed');
    }
  }, 10_000);
}
