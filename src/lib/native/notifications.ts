import { LocalNotifications } from '@capacitor/local-notifications';

const plugin = LocalNotifications;

export async function requestPermission(): Promise<boolean> {
  try {
    const result = await plugin.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleAlerts(taskId: string, title: string, dates: Date[]): Promise<void> {
  try {
    const id = hashTaskId(taskId);
    const notifications = dates.map((at, i) => ({
      id: id * 100 + i,
      title: 'Silvermind',
      body: title,
      schedule: { at },
    }));
    await plugin.schedule({ notifications });
  } catch {
    // Silently fail — notifications are best-effort
  }
}

export async function cancelAlerts(taskId: string): Promise<void> {
  try {
    const baseID = hashTaskId(taskId);
    // Cancel up to 20 alert slots (matching batched schedule)
    const ids = [];
    for (let i = 0; i < 20; i++) {
      ids.push({ id: baseID * 100 + i });
    }
    await plugin.cancel({ notifications: ids });
  } catch {
    // Silently fail
  }
}

function hashTaskId(taskId: string): number {
  let hash = 0;
  for (let i = 0; i < taskId.length; i++) {
    const ch = taskId.charCodeAt(i);
    hash = (hash << 5) - hash + ch;
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647 + 1;
}
