import { getTasksForSpace } from '$lib/api/tasks';
import { getSpaces } from '$lib/api/spaces';
import { formatError } from '$lib/helpers/format-error';
import type { Task } from '$lib/types/task';

interface RawSpace { name: string; url: string; active: boolean; }

export interface TaskWithSpace extends Task {
  _spaceName: string;
}

let tasks = $state<TaskWithSpace[]>([]);
let spaces = $state<RawSpace[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);

export function getGlobalTasks(): TaskWithSpace[] { return tasks; }
export function getGlobalSpaces(): RawSpace[] { return spaces; }
export function getGlobalLoading(): boolean { return isLoading; }
export function getGlobalError(): string | null { return error; }

export async function loadGlobalView(): Promise<void> {
  isLoading = true;
  error = null;
  try {
    const allSpaces: RawSpace[] = await getSpaces() as any;
    spaces = Array.isArray(allSpaces) ? allSpaces : [];

    const results = await Promise.allSettled(
      spaces.map(async (s) => {
        const spaceTasks = await getTasksForSpace(s.url);
        return spaceTasks.map((t: Task) => ({ ...t, _spaceName: s.name }));
      }),
    );

    const merged: TaskWithSpace[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        merged.push(...r.value);
      }
    }
    merged.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return 0;
    });
    tasks = merged;
  } catch (e) {
    error = formatError(e);
    console.error('[global] loadGlobalView failed:', e);
    tasks = [];
  } finally {
    isLoading = false;
  }
}

export function refreshGlobalView(): Promise<void> {
  return loadGlobalView();
}
