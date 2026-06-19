// Haptics wrapper — no-ops gracefully when Capacitor is unavailable (browser, non-iOS)

async function callHaptics(method: string, style: number): Promise<void> {
  try {
    const m = await import('@capacitor/haptics');
    const h = new m.Haptics();
    if (method === 'impact') {
      await (h as any).impact({ style });
    } else {
      await (h as any).notification({ type: style });
    }
  } catch { /* no haptics available */ }
}

export function impactLight() { callHaptics('impact', 0); }
export function impactMedium() { callHaptics('impact', 1); }
export function impactHeavy() { callHaptics('impact', 2); }
export function notifySuccess() { callHaptics('notification', 0); }
export function notifyError() { callHaptics('notification', 1); }
export function notifyWarning() { callHaptics('notification', 2); }
