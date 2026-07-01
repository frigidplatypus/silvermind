export function devLog(...args: unknown[]): void {
  console.error('[debug]', ...args);
}
