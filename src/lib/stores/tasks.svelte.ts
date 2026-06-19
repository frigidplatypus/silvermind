import type { Task } from '$lib/types/task';
import { getInbox } from '$lib/api/inbox';
import { getToday } from '$lib/api/today';

let _tasks = $state<Task[]>([]);
let _isLoading = $state(false);
let _lastError = $state<string | null>(null);

export function getTasks(): Task[] { return _tasks; }
export function getTasksLoading(): boolean { return _isLoading; }
export function getTasksError(): string | null { return _lastError; }

export async function loadInbox(): Promise<Task[]> {
  _isLoading = true;
  _lastError = null;
  try {
    _tasks = await getInbox();
  } catch (e) {
    _lastError = e instanceof Error ? e.message : 'Failed to load tasks';
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
    _lastError = e instanceof Error ? e.message : 'Failed to load today';
    return { overdue: [], due_today: [], scheduled_today: [] };
  } finally {
    _isLoading = false;
  }
}

export async function addTask(text: string): Promise<Task | null> {
  const { createTask } = await import('$lib/api/tasks');
  try {
    const task = await createTask({ text, page: 'Tasks' });
    _tasks = [task, ..._tasks];
    return task;
  } catch (e) {
    _lastError = e instanceof Error ? e.message : 'Failed to create task';
    return null;
  }
}
