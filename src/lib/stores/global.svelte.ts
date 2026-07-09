import { getTasksForSpace } from '$lib/api/tasks';
import { getConfigManager } from '$lib/backend/backend-context';
import { formatError } from '$lib/helpers/format-error';
import type { Task } from '$lib/types/task';
import { devLog } from '$lib/helpers/dev-log';
import { rescheduleAll } from './notifications.svelte';

interface RawSpace {
  name: string;
  url: string;
  active: boolean;
  default_page: string;
  auth_token?: string;
}

export interface TaskWithSpace extends Task {
  _spaceName: string;
}

let tasks = $state<TaskWithSpace[]>([]);
let spaces = $state<RawSpace[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);

export function getGlobalTasks(): TaskWithSpace[] {
  return tasks;
}
export function getGlobalSpaces(): RawSpace[] {
  return spaces;
}
export function getGlobalLoading(): boolean {
  return isLoading;
}
export function getGlobalError(): string | null {
  return error;
}

export async function loadGlobalView(): Promise<void> {
  isLoading = true;
  error = null;
  try {
    const cm = getConfigManager();
    await cm.load();
    const active = await cm.getActiveSpace();
    const allSpaces = await cm.getSpaces();
    spaces = allSpaces.map((s) => ({
      name: s.name,
      url: s.url,
      active: active?.name === s.name,
      default_page: s.default_page,
      auth_token: s.auth_token,
    }));

    const results = await Promise.allSettled(
      spaces.map(async (s) => {
        const spaceTasks = await getTasksForSpace(s);
        return spaceTasks.map((t: Task) => ({
          ...t,
          _spaceName: s.name,
          _spaceUrl: s.url,
          _spaceAuthToken: s.auth_token,
        }));
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
    rescheduleAll(merged);
  } catch (e) {
    error = formatError(e);
    devLog('[global] loadGlobalView failed:', e);
    tasks = [];
  } finally {
    isLoading = false;
  }
}

export function refreshGlobalView(): Promise<void> {
  return loadGlobalView();
}
