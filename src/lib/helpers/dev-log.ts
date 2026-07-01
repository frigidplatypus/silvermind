let _wailsInit = false;

export function devLog(...args: unknown[]): void {
  const rt = (window as any)?.runtime as Record<string, ((msg: string) => void)> | undefined;
  if (rt?.LogInfo) {
    if (!_wailsInit) {
      _wailsInit = true;
      try {
        (rt.SetLogLevel as (l: string) => void)?.('2'); // DEBUG level — overrides production default ERROR
      } catch { /* ignore */ }
    }
    rt.LogInfo('[debug] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  } else {
    console.error('[debug]', ...args);
  }
}
