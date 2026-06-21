import type { Task } from '$lib/types/task';
import type { QueryPage, QueryBlockInfo, QueryExecuteResult } from '$lib/api/queries';
import { getQueryPages, executeQuery } from '$lib/api/queries';

let queryPages = $state<QueryPage[]>([]);
let isLoading = $state(false);
let error = $state<string | null>(null);
let currentQueryTasks = $state<Task[]>([]);
let currentQueryTitle = $state<string | null>(null);
let queryLoading = $state(false);

export function getQueryPagesList(): QueryPage[] { return queryPages; }
export function getQueryPagesLoading(): boolean { return isLoading; }
export function getQueryPagesError(): string | null { return error; }
export function getCurrentQueryTasks(): Task[] { return currentQueryTasks; }
export function getCurrentQueryTitle(): string | null { return currentQueryTitle; }
export function getQueryLoading(): boolean { return queryLoading; }

export async function loadQueryPages(): Promise<void> {
  isLoading = true;
  error = null;
  try {
    queryPages = await getQueryPages();
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to load query pages';
  } finally {
    isLoading = false;
  }
}

export async function runQuery(page: string, index?: number): Promise<void> {
  queryLoading = true;
  error = null;
  currentQueryTasks = [];
  currentQueryTitle = null;
  try {
    const results = await executeQuery(page, index);
    if (results.length > 0) {
      // Flatten all tasks from all results
      const allTasks: Task[] = [];
      const titles: string[] = [];
      for (const result of results) {
        titles.push(result.title);
        allTasks.push(...result.tasks);
      }
      currentQueryTasks = allTasks;
      currentQueryTitle = titles.join(', ');
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Failed to run query';
  } finally {
    queryLoading = false;
  }
}

export function clearQueryResults(): void {
  currentQueryTasks = [];
  currentQueryTitle = null;
}
