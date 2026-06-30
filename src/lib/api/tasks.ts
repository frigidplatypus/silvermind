import { getSbClient, getActiveSpace } from '$lib/backend/backend-context';
import { toggleDone, toggleUndone, modifyTask, deleteTask, archiveTasks } from '$lib/backend/task-operations';
import { createTask } from '$lib/backend/inbox-operations';
import type { Task } from '$lib/types/task';

export type TaskListResponse = Task[];

export async function getTasks(params?: Record<string, string>): Promise<TaskListResponse> {
  const sbClient = getSbClient();
  const page = params?.page || 'Inbox';
  const { content } = await sbClient.readPage(page);
  const { parseTasksFromPage } = await import('$lib/backend/task-parser');
  const tasks = parseTasksFromPage(content, page) as Task[];
  if (params?.search) {
    const q = params.search.toLowerCase();
    return tasks.filter(t => t.text.toLowerCase().includes(q)).slice(0, 50);
  }
  return tasks;
}

export async function createTaskFn(input: Record<string, unknown>): Promise<Task> {
  const active = await getActiveSpace();
  if (!active) throw new Error('No active space');
  const sbClient = getSbClient();
  return createTask(input as any, active, sbClient) as Task;
}

export { createTaskFn as createTask };

function taskURL(position: number, page: string, suffix?: string): string {
  const qs = `page=${encodeURIComponent(page)}`;
  return `/tasks/${position}${suffix ?? ''}?${qs}`;
}

export async function updateTask(page: string, position: number, fields: Record<string, unknown>): Promise<Task> {
  const sbClient = getSbClient();
  const task = { page, position, ...fields } as any;
  return modifyTask(task, fields as any, sbClient) as Task;
}

export async function markTaskDone(page: string, position: number): Promise<Task> {
  const sbClient = getSbClient();
  const task = { page, position } as any;
  return toggleDone(task, sbClient) as Task;
}

export async function undoTask(page: string, position: number): Promise<Task> {
  const sbClient = getSbClient();
  const task = { page, position } as any;
  return toggleUndone(task, sbClient) as Task;
}

export async function deleteTaskFn(page: string, position: number): Promise<void> {
  const sbClient = getSbClient();
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
  const sbClient = getSbClient();
  const result = await archiveTasks(page, sbClient);
  return { archived: result.archived, page };
}

export { archiveTasksFn as archiveTasks };

export async function getTasksForSpace(spaceUrl: string, params?: Record<string, string>): Promise<TaskListResponse> {
  const sbClient = getSbClient();
  const page = params?.page || 'Inbox';
  const { content } = await sbClient.readPage(page);
  const { parseTasksFromPage } = await import('$lib/backend/task-parser');
  return parseTasksFromPage(content, page) as Task[];
}
