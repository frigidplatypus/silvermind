const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function requestPermissionWeb(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function scheduleAlertWeb(taskId: string, title: string, at: Date): Promise<void> {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const delay = at.getTime() - Date.now();
  if (delay <= 0) return;

  cancelAlertWeb(taskId);

  const timer = setTimeout(() => {
    new Notification('Silvermind', { body: title });
    timers.delete(taskId);
  }, delay);
  timers.set(taskId, timer);
}

export function cancelAlertWeb(taskId: string): void {
  const existing = timers.get(taskId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(taskId);
  }
}

export function cancelAllWeb(): void {
  for (const [id, timer] of timers) {
    clearTimeout(timer);
  }
  timers.clear();
}
