import { searchTasks, getTasksForSpace } from '$lib/api/tasks';
import { getSpaces } from '$lib/api/spaces';
import type { Task } from '$lib/types/task';

type SearchScope = 'active' | 'global';

let query = $state('');
let results = $state<Task[]>([]);
let isSearching = $state(false);
let isActive = $state(false);
let scope: SearchScope = 'active';
let _debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function getQuery(): string { return query; }
export function getResults(): Task[] { return results; }
export function getIsSearching(): boolean { return isSearching; }
export function getIsActive(): boolean { return isActive; }

export function activateSearch(s?: SearchScope): void {
  scope = s ?? 'active';
  isActive = true;
}

export function deactivateSearch(): void {
  isActive = false;
  query = '';
  results = [];
  isSearching = false;
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
}

async function doSearch(value: string): Promise<void> {
  if (scope === 'global') {
    const allSpaces: { name: string; url: string }[] = await getSpaces() as any;
    const settled = await Promise.allSettled(
      (Array.isArray(allSpaces) ? allSpaces : []).map(s =>
        getTasksForSpace(s.url, { search: value }),
      ),
    );
    const merged: Task[] = [];
    for (const r of settled) {
      if (r.status === 'fulfilled') merged.push(...r.value);
    }
    results = merged;
  } else {
    const r = await searchTasks(value);
    results = r;
  }
}

export function setQuery(value: string): void {
  query = value;
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
  if (!value.trim()) {
    results = [];
    isSearching = false;
    return;
  }
  isSearching = true;
  _debounceTimer = setTimeout(async () => {
    try {
      await doSearch(value);
    } catch {
      results = [];
    } finally {
      isSearching = false;
    }
  }, 300);
}

/**
 * Public search function for immediate (non-debounced) usage.
 */
export async function immediateSearch(value: string): Promise<void> {
  query = value;
  if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
  if (!value.trim()) {
    results = [];
    isSearching = false;
    return;
  }
  isSearching = true;
  try {
    await doSearch(value);
  } catch {
    results = [];
  } finally {
    isSearching = false;
  }
}
