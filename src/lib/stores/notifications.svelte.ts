import { scheduleAlerts, cancelAlerts, requestPermission } from '$lib/native/notifications';
import { scheduleAlertWeb, cancelAlertWeb, requestPermissionWeb } from '$lib/native/notifications-web';
import type { Task } from '$lib/types/task';
import { updateTask } from '$lib/api/tasks';

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

  const now = Date.now();
  const validAlerts: string[] = [];
  const validDates: Date[] = [];

  for (const alert of task.alerts) {
    const at = parseAlertDate(alert);
    if (!at) continue;
    if (at.getTime() <= now) continue;
    validAlerts.push(alert);
    validDates.push(at);
    scheduleAlertWeb(taskId, title, at);
  }

  if (validDates.length > 0) {
    scheduleAlerts(taskId, title, validDates);
  }

  // If some alerts were stale (past), remove them from the task
  if (validAlerts.length < task.alerts.length) {
    cleanStaleAlerts(task, validAlerts);
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

async function cleanStaleAlerts(task: Task, validAlerts: string[]) {
  try {
    await updateTask(task.page, task.position, {
      alerts: validAlerts.length > 0 ? validAlerts : [],
    });
    // Update the task object in-place so subsequent code sees the cleaned alerts
    task.alerts = validAlerts.length > 0 ? validAlerts : [];
  } catch {
    // Silently fail — best-effort cleanup
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
