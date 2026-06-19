import { api } from './client';
import type { Task } from '$lib/types/task';

export async function markDone(page: string, position: number): Promise<Task> {
  return api.post<Task>(`/tasks/${page}/${position}/done`);
}
