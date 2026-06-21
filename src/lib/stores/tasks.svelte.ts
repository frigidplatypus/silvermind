import type { Task } from '$lib/types/task';
import { getInbox } from '$lib/api/inbox';
import { getToday } from '$lib/api/today';
import { createTask } from '$lib/api/tasks';
import { ApiClientError } from '$lib/api/client';
import { getActiveSpace } from '$lib/stores/space.svelte';

let _tasks = $state<Task[]>([]);
let _isLoading = $state(false);
let _lastError = $state<string | null>(null);

export function getTasks(): Task[] { return _tasks; }
export function getTasksLoading(): boolean { return _isLoading; }
export function getTasksError(): string | null { return _lastError; }

function formatError(e: unknown): string {
  const space = getActiveSpace();
  const spaceTag = space ? `[${space.name}] ` : '';
  if (e instanceof ApiClientError) {
    const detail = e.details ? ` — ${JSON.stringify(e.details)}` : '';
    return `${spaceTag}HTTP ${e.status}${e.code ? ` (${e.code})` : ''}: ${e.message}${detail}`;
  }
  if (e instanceof TypeError && e.message === 'Failed to fetch') {
    return `${spaceTag}Cannot reach server at localhost:7433. Is sbtask running?`;
  }
  return `${spaceTag}${e instanceof Error ? e.message : String(e)}`;
}

export async function loadInbox(): Promise<Task[]> {
  _isLoading = true;
  _lastError = null;
  try {
    _tasks = await getInbox();
  } catch (e) {
    _lastError = formatError(e);
  } finally {
    _isLoading = false;
  }
  return _tasks;
}

export async function loadToday(): Promise<{ overdue: Task[]; due_today: Task[]; scheduled_today: Task[] }> {
  _isLoading = true;
  _lastError = null;
  try {
    return await getToday();
  } catch (e) {
    _lastError = formatError(e);
    return { overdue: [], due_today: [], scheduled_today: [] };
  } finally {
    _isLoading = false;
  }
}

export async function addTask(text: string): Promise<Task | null> {
  try {
    const task = await createTask({ text });
    await loadInbox();
    return task;
  } catch (e) {
    _lastError = formatError(e);
    return null;
  }
}
