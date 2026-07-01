export function devLog(...args: unknown[]): void {
  const wailsLog = (window as any)?.runtime?.LogInfo as ((msg: string) => void) | undefined;
  if (wailsLog) {
    wailsLog('[debug] ' + args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  } else {
    console.error('[debug]', ...args);
  }
}
