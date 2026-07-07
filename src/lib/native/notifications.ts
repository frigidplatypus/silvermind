const ALERT_ID_STRIDE = 100;
const MAX_ALERTS_PER_TASK = 20;
const MAPPING_KEY = 'notification_task_ids';
const NEXT_ID_KEY = 'notification_next_base_id';

export async function requestPermission(): Promise<boolean> {
  try {
    const { LocalNotifications } = (await import('@capacitor/local-notifications')) as any;
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleAlerts(taskId: string, title: string, dates: Date[]): Promise<void> {
  try {
    const { LocalNotifications } = (await import('@capacitor/local-notifications')) as any;
    const baseId = await getOrCreateBaseId(taskId);
    const notifications = dates.slice(0, MAX_ALERTS_PER_TASK).map((at, i) => ({
      id: baseId + i,
      title: 'Silvermind',
      body: title,
      schedule: { at },
    }));

    await LocalNotifications.cancel({ notifications: buildNotificationIds(baseId) });
    await LocalNotifications.schedule({ notifications });
  } catch {
    // Silently fail — notifications are best-effort
  }
}

export async function cancelAlerts(taskId: string): Promise<void> {
  try {
    const { LocalNotifications } = (await import('@capacitor/local-notifications')) as any;
    const baseId = await getBaseId(taskId);
    if (baseId == null) return;
    await LocalNotifications.cancel({ notifications: buildNotificationIds(baseId) });
  } catch {
    // Silently fail
  }
}

async function getPreferences() {
  const { Preferences } = await import('@capacitor/preferences');
  return Preferences;
}

async function getTaskIdMap(): Promise<Record<string, number>> {
  const Preferences = await getPreferences();
  const result = await Preferences.get({ key: MAPPING_KEY });
  if (!result.value) return {};
  try {
    return JSON.parse(result.value) as Record<string, number>;
  } catch {
    return {};
  }
}

async function saveTaskIdMap(map: Record<string, number>): Promise<void> {
  const Preferences = await getPreferences();
  await Preferences.set({ key: MAPPING_KEY, value: JSON.stringify(map) });
}

async function getBaseId(taskId: string): Promise<number | null> {
  const map = await getTaskIdMap();
  return map[taskId] ?? null;
}

async function getOrCreateBaseId(taskId: string): Promise<number> {
  const map = await getTaskIdMap();
  const existing = map[taskId];
  if (existing != null) {
    return existing;
  }

  const Preferences = await getPreferences();
  const nextIdResult = await Preferences.get({ key: NEXT_ID_KEY });
  const nextBaseId = Number.parseInt(nextIdResult.value ?? '1000', 10) || 1000;

  map[taskId] = nextBaseId;
  await saveTaskIdMap(map);
  await Preferences.set({ key: NEXT_ID_KEY, value: String(nextBaseId + ALERT_ID_STRIDE) });
  return nextBaseId;
}

function buildNotificationIds(baseId: number): Array<{ id: number }> {
  const ids = [];
  for (let i = 0; i < MAX_ALERTS_PER_TASK; i++) {
    ids.push({ id: baseId + i });
  }
  return ids;
}
