import { api } from './client';
import type { Task } from '$lib/types/task';

export async function undoTask(page: string, position: number): Promise<Task> {
  return api.post<Task>(`/tasks/${page}/${position}/undo`);
}
