import {
  getSbClient,
  getActiveSpace,
  getConfigManager,
  getSpaceConfig,
} from '$lib/backend/backend-context';
import {
  toggleDone,
  toggleUndone,
  modifyTask,
  deleteTask,
  archiveTasks,
} from '$lib/backend/task-operations';
import { createTask } from '$lib/backend/inbox-operations';
import { createSbClient } from '$lib/backend/sb-client';
import type { Task } from '$lib/types/task';
import type { SpaceConfig, SpaceConfigRemote } from '$lib/backend/task-types';
import { applyDefaultViewExclusions, applyGlobalTaskExclusions } from '$lib/backend/query-engine';
import { mapRuntimeTask } from '$lib/backend/task-parser';
import { loadTasks } from '$lib/backend/inbox-operations';
import { logInfo, logWarn } from '$lib/helpers/logger';

export type TaskListResponse = Task[];

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

function filterFallbackTasks(tasks: Task[], params?: Record<string, string>): Task[] {
  let filtered = tasks;

  if (params?.page) {
    filtered = filtered.filter((task) => task.page === params.page);
  }

  const search = (params?.search || params?.filter || '').trim().toLowerCase();
  if (search) {
    filtered = filtered.filter((task) => {
      const haystack = [task.text, task.name, task.page, task.priority, ...(task.tags || [])]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }

  const limit = Number(params?.limit || 0);
  if (Number.isFinite(limit) && limit > 0) {
    filtered = filtered.slice(0, limit);
  }

  return filtered;
}

function applyConfiguredDefaultExclusions(
  tasks: Task[],
  sbClient: ReturnType<typeof createSbClient>,
  excludeTags: string[],
): Promise<Task[]> {
  return applyDefaultViewExclusions(tasks, sbClient, excludeTags);
}

async function loadTaskList(
  space: SpaceConfig,
  params?: Record<string, string>,
  spaceConfig?: SpaceConfigRemote,
): Promise<TaskListResponse> {
  const sbClient = createSbClient({ spaceURL: space.url, authToken: space.auth_token });
  const queryParams: Record<string, string> = { ...params };

  try {
    const runtimeTasks = await withTimeout(
      sbClient.queryTasks(queryParams),
      6000,
      `Runtime task list for ${space.name}`,
    );
    const mapped = runtimeTasks.map(mapRuntimeTask) as Task[];
    const excludeTags = spaceConfig?.exclude_tags || [];
    return (await applyGlobalTaskExclusions(
      await applyConfiguredDefaultExclusions(mapped, sbClient, excludeTags),
      sbClient,
    )) as TaskListResponse;
  } catch (e: any) {
    logWarn(
      `[tasks-api] runtime task list failed; falling back to .fs pages — space="${space.name}" url="${space.url}" error="${e?.message || e}"`,
    );
  }

  const fallback = await loadTasks(space, sbClient, 0, spaceConfig);
  return (await applyGlobalTaskExclusions(
    filterFallbackTasks(fallback, params),
    sbClient,
  )) as TaskListResponse;
}

async function getClientForTask(task: Task) {
  if (task._spaceUrl) {
    logInfo(
      `[tasks-api] target client from task space url — space="${task._spaceName ?? ''}" url="${task._spaceUrl}" page="${task.page}" pos=${task.position}`,
    );
    return createSbClient({
      spaceURL: task._spaceUrl,
      authToken: task._spaceAuthToken,
    });
  }

  if (task._spaceName) {
    const cm = getConfigManager();
    await cm.load();
    const space = (await cm.getSpaces()).find((s) => s.name === task._spaceName);
    if (space) {
      logInfo(
        `[tasks-api] target client from task space name — space="${task._spaceName}" url="${space.url}" page="${task.page}" pos=${task.position}`,
      );
      return createSbClient({
        spaceURL: space.url,
        authToken: space.auth_token,
      });
    }
    logWarn(
      `[tasks-api] task space name not found; falling back to active space — space="${task._spaceName}" page="${task.page}" pos=${task.position}`,
    );
  }

  logInfo(
    `[tasks-api] target client from active space fallback — page="${task.page}" pos=${task.position}`,
  );
  return getSbClient();
}

export async function getTasks(params?: Record<string, string>): Promise<TaskListResponse> {
  const active = await getActiveSpace();
  if (!active) return [];
  const sbClient = await getSbClient();
  const spaceConfig = getSpaceConfig();
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams['page'] = params.page;
  if (params?.search) {
    queryParams['filter'] = params.search;
    queryParams['limit'] = '50';
  }
  try {
    const runtimeTasks = await withTimeout(
      sbClient.queryTasks(queryParams),
      6000,
      `Runtime task list for ${active.name}`,
    );
    const mapped = runtimeTasks.map(mapRuntimeTask) as Task[];
    const excludeTags = spaceConfig.exclude_tags || [];
    return (await applyGlobalTaskExclusions(
      await applyConfiguredDefaultExclusions(mapped, sbClient, excludeTags),
      sbClient,
    )) as TaskListResponse;
  } catch (e: any) {
    logWarn(
      `[tasks-api] active runtime task list failed; falling back to .fs pages — space="${active.name}" error="${e?.message || e}"`,
    );
  }
  const fallback = await loadTasks(active, sbClient, 0, spaceConfig);
  return (await applyGlobalTaskExclusions(
    filterFallbackTasks(fallback, params),
    sbClient,
  )) as TaskListResponse;
}

export async function createTaskFn(input: Record<string, unknown>): Promise<Task> {
  const active = await getActiveSpace();
  if (!active) throw new Error('No active space');
  const sbClient = await getSbClient();
  const spaceConfig = getSpaceConfig();
  return (await createTask(input as any, active, sbClient, spaceConfig)) as Task;
}

export { createTaskFn as createTask };

function taskURL(position: number, page: string, suffix?: string): string {
  const qs = `page=${encodeURIComponent(page)}`;
  return `/tasks/${position}${suffix ?? ''}?${qs}`;
}

export async function updateTask(
  page: string,
  position: number,
  fields: Record<string, unknown>,
): Promise<Task> {
  const sbClient = await getSbClient();
  const task = { page, position, ...fields } as any;
  return (await modifyTask(task, fields as any, sbClient)) as Task;
}

export async function markTaskDone(task: Task): Promise<Task> {
  logInfo(
    `[tasks-api] markTaskDone requested — space="${task._spaceName ?? ''}" url="${task._spaceUrl ?? ''}" page="${task.page}" pos=${task.position} status="${task.status}" done=${task.done} text="${(task.text || '').slice(0, 120)}"`,
  );
  const sbClient = await getClientForTask(task);
  return (await toggleDone(task, sbClient)) as Task;
}

export async function undoTask(task: Task): Promise<Task> {
  logInfo(
    `[tasks-api] undoTask requested — space="${task._spaceName ?? ''}" url="${task._spaceUrl ?? ''}" page="${task.page}" pos=${task.position} status="${task.status}" done=${task.done} text="${(task.text || '').slice(0, 120)}"`,
  );
  const sbClient = await getClientForTask(task);
  return (await toggleUndone(task, sbClient)) as Task;
}

export async function deleteTaskFn(task: Task): Promise<void> {
  const sbClient = await getClientForTask(task);
  return deleteTask(task, sbClient);
}

export { deleteTaskFn as deleteTask };

export async function searchTasks(query: string): Promise<TaskListResponse> {
  if (!query.trim()) return [];
  return getTasks({ search: query });
}

export interface ArchiveResponse {
  archived: number;
  page: string;
}

export async function archiveTasksFn(page: string): Promise<ArchiveResponse> {
  const sbClient = await getSbClient();
  const result = await archiveTasks(page, sbClient);
  return { archived: result.archived, page };
}

export { archiveTasksFn as archiveTasks };

export async function getTasksForSpace(
  spaceOrUrl: SpaceConfig | string,
  authTokenOrParams?: string | Record<string, string>,
  params?: Record<string, string>,
): Promise<TaskListResponse> {
  const queryParamsInput = typeof authTokenOrParams === 'object' ? authTokenOrParams : params;
  const space =
    typeof spaceOrUrl === 'string'
      ? {
          name: spaceOrUrl,
          url: spaceOrUrl,
          default_page: 'Tasks',
          auth_token: typeof authTokenOrParams === 'string' ? authTokenOrParams : undefined,
        }
      : spaceOrUrl;
  return loadTaskList(space, queryParamsInput);
}
