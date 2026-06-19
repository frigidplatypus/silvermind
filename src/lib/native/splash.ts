// SplashScreen wrapper — no-ops gracefully when Capacitor is unavailable

async function callSplash(method: string, arg?: any): Promise<void> {
  try {
    const m = await import('@capacitor/splash-screen');
    const ss = new m.SplashScreen();
    await (ss as any)[method](arg);
  } catch { /* no splash available */ }
}

export function showSplash() { return callSplash('show', { fadeInDuration: 0 }); }
export function hideSplash() { return callSplash('hide', { fadeOutDuration: 300 }); }
