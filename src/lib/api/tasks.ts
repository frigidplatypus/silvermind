import { getSbClient, getActiveSpace } from '$lib/backend/backend-context';
import { toggleDone, toggleUndone, modifyTask, deleteTask, archiveTasks } from '$lib/backend/task-operations';
import { createTask } from '$lib/backend/inbox-operations';
import { createSbClient } from '$lib/backend/sb-client';
import type { Task } from '$lib/types/task';

export type TaskListResponse = Task[];

export async function getTasks(params?: Record<string, string>): Promise<TaskListResponse> {
  const sbClient = await getSbClient();
  const queryParams: Record<string, string> = {};
  if (params?.page) queryParams['page'] = params.page;
  if (params?.search) {
    queryParams['filter'] = params.search;
    queryParams['limit'] = '50';
  }
  const runtimeTasks = await sbClient.queryTasks(queryParams);
  return runtimeTasks.map((rt: any) => ({
    page: rt.page || '',
    position: rt.pos || 0,
    text: rt.text || '',
    status: rt.status || '',
    done: rt.done || false,
    due: rt.due || '',
    due_parsed: rt.due_parsed || null,
    deferred: rt.deferred || '',
    deferred_parsed: rt.deferred_parsed || null,
    name: rt.name || '',
    priority: rt.priority || '',
    tags: rt.tags || [],
    parent: rt.parent,
    depends_on: rt.depends_on,
    blocked: false,
    recur: rt.recur,
    alerts: rt.alerts,
    extra_attrs: rt.extra_attrs,
  })) as Task[];
}

export async function createTaskFn(input: Record<string, unknown>): Promise<Task> {
  const active = await getActiveSpace();
  if (!active) throw new Error('No active space');
  const sbClient = await getSbClient();
  return createTask(input as any, active, sbClient) as Task;
}

export { createTaskFn as createTask };

function taskURL(position: number, page: string, suffix?: string): string {
  const qs = `page=${encodeURIComponent(page)}`;
  return `/tasks/${position}${suffix ?? ''}?${qs}`;
}

export async function updateTask(page: string, position: number, fields: Record<string, unknown>): Promise<Task> {
  const sbClient = await getSbClient();
  const task = { page, position, ...fields } as any;
  return modifyTask(task, fields as any, sbClient) as Task;
}

export async function markTaskDone(page: string, position: number): Promise<Task> {
  const sbClient = await getSbClient();
  const task = { page, position } as any;
  return toggleDone(task, sbClient) as Task;
}

export async function undoTask(page: string, position: number): Promise<Task> {
  const sbClient = await getSbClient();
  const task = { page, position } as any;
  return toggleUndone(task, sbClient) as Task;
}

export async function deleteTaskFn(page: string, position: number): Promise<void> {
  const sbClient = await getSbClient();
  const task = { page, position } as any;
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

export async function getTasksForSpace(spaceUrl: string, params?: Record<string, string>): Promise<TaskListResponse> {
  const tempClient = createSbClient({ spaceURL: spaceUrl });
  const queryParams: Record<string, string> = { ...params };
  const runtimeTasks = await tempClient.queryTasks(queryParams);
  return runtimeTasks.map((rt: any) => ({
    page: rt.page || '',
    position: rt.pos || 0,
    text: rt.text || '',
    status: rt.status || '',
    done: rt.done || false,
    due: rt.due || '',
    due_parsed: rt.due_parsed || null,
    deferred: rt.deferred || '',
    deferred_parsed: rt.deferred_parsed || null,
    name: rt.name || '',
    priority: rt.priority || '',
    tags: rt.tags || [],
    parent: rt.parent,
    depends_on: rt.depends_on,
    blocked: false,
    recur: rt.recur,
    alerts: rt.alerts,
    extra_attrs: rt.extra_attrs,
  })) as Task[];
}
