import { api } from './client';
import type { Task } from '$lib/types/task';

export async function getInbox(): Promise<Task[]> {
  // sbtask serve: GET /tasks returns all tasks; filter active on client
  const tasks = await api.get<Task[]>('/tasks');
  return tasks.filter((t) => !t.done);
}
