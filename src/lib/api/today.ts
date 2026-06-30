import { getSbClient, getActiveSpace } from '$lib/backend/backend-context';
import { getToday as getTodayOps } from '$lib/backend/today-operations';
import type { Task } from '$lib/types/task';

export interface TodayResponse {
  overdue: Task[];
  due_today: Task[];
  deferred_today: Task[];
  all_clear: boolean;
}

export async function getToday(): Promise<TodayResponse> {
  const active = await getActiveSpace();
  if (!active) {
    return { overdue: [], due_today: [], deferred_today: [], all_clear: true };
  }
  const sbClient = getSbClient();
  const page = active.default_page || 'Tasks';
  const result = await getTodayOps(page, sbClient);
  return {
    overdue: result.overdue as Task[],
    due_today: result.dueToday as Task[],
    deferred_today: result.deferredToday as Task[],
    all_clear: result.allClear,
  };
}
