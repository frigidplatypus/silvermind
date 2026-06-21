import { api } from './client';
import type { Task } from '$lib/types/task';

export type TaskListResponse = Task[];

export async function getTasks(params?: Record<string, string>): Promise<TaskListResponse> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  return api.get<TaskListResponse>(`/tasks${qs}`);
}

export async function createTask(input: Record<string, unknown>): Promise<Task> {
  // sbtask serve: POST /inbox creates a task on the space's configured inbox page
  return api.post<Task>('/inbox', input);
}

export async function updateTask(page: string, position: number, fields: Record<string, unknown>): Promise<Task> {
  return api.put<Task>(`/tasks/${encodeURIComponent(page)}/${position}`, fields);
}

export async function markTaskDone(page: string, position: number): Promise<Task> {
  return api.put<Task>(`/tasks/${encodeURIComponent(page)}/${position}/done`);
}

export async function undoTask(page: string, position: number): Promise<Task> {
  return api.put<Task>(`/tasks/${encodeURIComponent(page)}/${position}/undo`);
}

export async function deleteTask(page: string, position: number): Promise<void> {
  return api.delete<void>(`/tasks/${encodeURIComponent(page)}/${position}`);
}
