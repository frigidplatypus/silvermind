// StatusBar wrapper — no-ops gracefully when Capacitor is unavailable

async function callBar(method: string, arg?: any): Promise<void> {
  try {
    const m = await import('@capacitor/status-bar');
    const sb = new m.StatusBar();
    await (sb as any)[method](arg);
  } catch { /* no status bar available */ }
}

export function setDarkStyle() { return callBar('setStyle', { style: 1 }); }
export function setLightStyle() { return callBar('setStyle', { style: 0 }); }
export function setBackgroundColor(color: string) { return callBar('setBackgroundColor', { color }); }
export function show() { return callBar('show'); }
export function hide() { return callBar('hide'); }
