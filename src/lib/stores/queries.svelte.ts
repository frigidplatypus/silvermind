import type { Task } from '$lib/types/task';
import type { QueryPage, QueryBlockInfo, QueryExecuteResult } from '$lib/api/queries';
import type { FavoriteQuery } from '$lib/backend/task-types';
import {
  getQueryPages,
  executeQuery,
  getQueryBlocks,
  getFavorites,
  getQueryPageNames,
} from '$lib/api/queries';
import { formatError } from '$lib/helpers/format-error';
import { devLog } from '$lib/helpers/dev-log';
import { logInfo, logError } from '$lib/helpers/logger';

let queryPages = $state<QueryPage[]>([]);
let pagesLoading = $state(false);
let pagesError = $state<string | null>(null);
let queryError = $state<string | null>(null);
let errorSLIQ = $state<string | null>(null);
let currentQueryTasks = $state<Task[]>([]);
let currentQueryTitle = $state<string | null>(null);
let queryLoading = $state(false);
let favoriteQueries = $state<FavoriteQuery[]>([]);
let pageNames = $state<string[]>([]);
let pageNamesLoading = $state(false);

export function getQueryPagesList(): QueryPage[] {
  return queryPages;
}
export function getQueryPagesLoading(): boolean {
  return pagesLoading;
}
export function getQueryPagesError(): string | null {
  return pagesError;
}
export function getQueryError(): string | null {
  return queryError;
}
export function getCurrentQueryTasks(): Task[] {
  return currentQueryTasks;
}
export function getCurrentQueryTitle(): string | null {
  return currentQueryTitle;
}
export function getQueryLoading(): boolean {
  return queryLoading;
}
export function getErrorSLIQ(): string | null {
  return errorSLIQ;
}

export function getFavoriteQueries(): FavoriteQuery[] {
  return favoriteQueries;
}

export function getPageNames(): string[] {
  return pageNames;
}
export function getPageNamesLoading(): boolean {
  return pageNamesLoading;
}

export async function loadPageNames(): Promise<void> {
  if (pageNamesLoading) return;
  pageNamesLoading = true;
  try {
    pageNames = await getQueryPageNames();
    logInfo(`[queries-store] loadPageNames done: ${pageNames.length} pages`);
  } catch (e) {
    logError('[queries-store] loadPageNames failed:', e);
  } finally {
    pageNamesLoading = false;
  }
}

export async function loadQueryPages(refresh = false): Promise<void> {
  logInfo(`[queries-store] loadQueryPages called (refresh=${refresh})`);
  pagesLoading = true;
  pagesError = null;
  try {
    queryPages = await getQueryPages(undefined, refresh);
    favoriteQueries = getFavorites();
    logInfo(`[queries-store] loadQueryPages done: ${queryPages.length} pages`);
    await loadPageNames();
  } catch (e) {
    pagesError = formatError(e);
    logError('[queries-store] loadQueryPages failed:', e);
  } finally {
    pagesLoading = false;
  }
}

export async function runQuery(page: string, index?: number): Promise<void> {
  queryLoading = true;
  queryError = null;
  errorSLIQ = null;

  // Pre-load title from already-loaded queryPages so it's available on failure
  const qp = queryPages.find((p) => p.page === page);
  const preBlock = qp?.blocks.find((b) => b.number === (index ?? 1));
  currentQueryTitle = preBlock?.title ?? qp?.page ?? null;

  currentQueryTasks = [];

  try {
    const results = await executeQuery(page, index);
    if (results.length > 0) {
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
    queryError = formatError(e);
    devLog('[queries] runQuery failed:', e);
    // Fetch the SLIQ so the user can open it in the editor
    try {
      const blocks = await getQueryBlocks(page);
      const block = index ? blocks.find((b) => b.number === index) : blocks[0];
      if (block?.sliq) errorSLIQ = block.sliq;
    } catch {
      /* best effort */
    }
  } finally {
    queryLoading = false;
  }
}

export function clearQueryResults(): void {
  currentQueryTasks = [];
  currentQueryTitle = null;
  queryError = null;
  errorSLIQ = null;
}
