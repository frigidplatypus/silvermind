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

function taskURL(position: number, page: string, suffix?: string): string {
  const qs = `page=${encodeURIComponent(page)}`;
  return `/tasks/${position}${suffix ?? ''}?${qs}`;
}

export async function updateTask(page: string, position: number, fields: Record<string, unknown>): Promise<Task> {
  return api.put<Task>(taskURL(position, page), fields);
}

export async function markTaskDone(page: string, position: number): Promise<Task> {
  return api.put<Task>(taskURL(position, page, '/done'));
}

export async function undoTask(page: string, position: number): Promise<Task> {
  return api.put<Task>(taskURL(position, page, '/undo'));
}

export async function deleteTask(page: string, position: number): Promise<void> {
  return api.delete<void>(taskURL(position, page));
}

export async function searchTasks(query: string): Promise<TaskListResponse> {
  if (!query.trim()) return [];
  return api.get<TaskListResponse>(`/tasks?search=${encodeURIComponent(query)}&limit=50`);
}

export async function getTasksForSpace(spaceUrl: string, params?: Record<string, string>): Promise<TaskListResponse> {
  const qs = params ? '&' + new URLSearchParams(params).toString() : '';
  return api.get<TaskListResponse>(`/tasks?space_url=${encodeURIComponent(spaceUrl)}&limit=500${qs}`);
}
