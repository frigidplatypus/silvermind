import type { Task } from '$lib/types/task';
import { getInbox } from '$lib/api/inbox';
import { getToday } from '$lib/api/today';
import { createTask } from '$lib/api/tasks';
import { getActiveSpace } from '$lib/stores/space.svelte';
import { loadGlobalView } from '$lib/stores/global.svelte';
import { formatError } from '$lib/helpers/format-error';

let _tasks = $state<Task[]>([]);
let _isLoading = $state(false);
let _lastError = $state<string | null>(null);

let _overdue = $state<Task[]>([]);
let _dueToday = $state<Task[]>([]);
let _deferredToday = $state<Task[]>([]);

export function getTasks(): Task[] { return _tasks; }
export function getTasksLoading(): boolean { return _isLoading; }
export function getTasksError(): string | null { return _lastError; }
export function getTodayOverdue(): Task[] { return _overdue; }
export function getTodayDue(): Task[] { return _dueToday; }
export function getTodayDeferred(): Task[] { return _deferredToday; }

export async function loadInbox(): Promise<Task[]> {
  _isLoading = true;
  _lastError = null;
  try {
    _tasks = await getInbox();
    ensurePolling();
  } catch (e) {
    _lastError = formatError(e, getActiveSpace()?.name);
    console.error('[tasks] loadInbox failed:', e);
  } finally {
    _isLoading = false;
  }
  return _tasks;
}

export async function loadToday(): Promise<{ overdue: Task[]; due_today: Task[]; deferred_today: Task[] }> {
  _isLoading = true;
  _lastError = null;
  try {
    const data = await getToday();
    _overdue = data.overdue;
    _dueToday = data.due_today;
    _deferredToday = data.deferred_today;
    return data;
  } catch (e) {
    _lastError = formatError(e, getActiveSpace()?.name);
    console.error('[tasks] loadToday failed:', e);
    return { overdue: [], due_today: [], deferred_today: [] };
  } finally {
    _isLoading = false;
  }
}

export async function addTask(text: string): Promise<Task | null> {
  try {
    const task = await createTask({ text });
    // Refresh lists in background — don't block the FAB from closing
    Promise.all([loadInbox(), loadToday()]).catch(() => {});
    loadGlobalView();
    return task;
  } catch (e) {
    _lastError = formatError(e, getActiveSpace()?.name);
    console.error('[tasks] addTask failed:', e);
    return null;
  }
}

/* ── background polling ── */

const POLL_INTERVAL = 30_000;

let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _pollInFlight = false;

function tasksEqual(a: Task[], b: Task[]): boolean {
  if (a.length !== b.length) return false;
  const mapB = new Map<string, Task>();
  for (const t of b) mapB.set(`${t.page}/${t.position}`, t);
  for (const ta of a) {
    const tb = mapB.get(`${ta.page}/${ta.position}`);
    if (!tb) return false;
    if (ta.text !== tb.text || ta.done !== tb.done ||
      ta.status !== tb.status || ta.due !== tb.due ||
      ta.priority !== tb.priority) return false;
    if (JSON.stringify(ta.tags) !== JSON.stringify(tb.tags)) return false;
  }
  return true;
}

async function pollInbox(): Promise<void> {
  if (_isLoading || _pollInFlight) return;
  _pollInFlight = true;
  try {
    const fresh = await getInbox();
    if (!tasksEqual(_tasks, fresh)) {
      _tasks = fresh;
    }
  } catch {
    /* silently ignore background poll errors */
  } finally {
    _pollInFlight = false;
  }
}

function ensurePolling(): void {
  if (_pollTimer) return;
  _pollTimer = setInterval(pollInbox, POLL_INTERVAL);
}

export function stopPolling(): void {
  if (_pollTimer) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}
