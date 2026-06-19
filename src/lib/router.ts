// Simple client-side hash router — #/inbox, #/today

export function goto(path: string): void {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  window.location.hash = `#${normalized}`;
}
