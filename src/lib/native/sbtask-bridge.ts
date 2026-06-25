export async function startSbtaskService(): Promise<void> {
  try {
    const win = window as any;
    const plugin = win?.Capacitor?.Plugins?.SbtaskPlugin;
    if (!plugin) {
      // plugin not loaded — Capacitor runtime may not be ready yet
      return;
    }
    if (typeof plugin.start !== 'function') {
      // Capacitor runtime loaded but plugin method not available
      return;
    }
    await plugin.start();
  } catch { /* plugin not available — non-Capacitor environment */ }
}
