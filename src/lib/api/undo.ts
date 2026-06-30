import { getSbClient } from '$lib/backend/backend-context';
import { toggleUndone } from '$lib/backend/task-operations';
import type { Task } from '$lib/types/task';

export async function undoTask(page: string, position: number): Promise<Task> {
  const sbClient = getSbClient();
  const task = { page, position } as any;
  return toggleUndone(task, sbClient) as Task;
}
