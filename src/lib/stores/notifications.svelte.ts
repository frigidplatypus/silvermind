import { scheduleAlerts, cancelAlerts, requestPermission } from '$lib/native/notifications';
import { scheduleAlertWeb, cancelAlertWeb, requestPermissionWeb } from '$lib/native/notifications-web';
import type { Task } from '$lib/types/task';

let _initialized = false;

export function initNotifications() {
  if (_initialized) return;
  _initialized = true;

  requestPermission().catch(() => {});
  requestPermissionWeb().catch(() => {});
}

export function scheduleForTask(task: Task) {
  if (!task.alerts || task.alerts.length === 0) return;
  if (task.done) return;

  const taskId = `${task.page}:${task.position}`;
  const title = task.text.slice(0, 100);

  const validDates: Date[] = [];
  for (const alert of task.alerts) {
    const at = parseAlertDate(alert);
    if (!at || at.getTime() <= Date.now()) continue;
    validDates.push(at);
    scheduleAlertWeb(taskId, title, at);
  }
  if (validDates.length > 0) {
    scheduleAlerts(taskId, title, validDates);
  }
}

export function cancelForTask(task: Task) {
  const taskId = `${task.page}:${task.position}`;
  cancelAlerts(taskId);
  cancelAlertWeb(taskId);
}

export function rescheduleAll(tasks: Task[]) {
  for (const task of tasks) {
    if (task.done) {
      cancelForTask(task);
    } else {
      scheduleForTask(task);
    }
  }
}

function parseAlertDate(alert: string): Date | null {
  // Expects YYYY-MM-DD HH:MM
  const parts = alert.trim().split(/[ T]/);
  if (parts.length < 2) return null;
  const datePart = parts[0];
  const timePart = parts[1];
  const d = new Date(`${datePart}T${timePart}:00`);
  if (isNaN(d.getTime())) return null;
  return d;
}
