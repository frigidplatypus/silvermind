import { api } from './client';
import type { Task } from '$lib/types/task';

export interface TodayResponse {
  overdue: Task[];
  due_today: Task[];
  scheduled_today: Task[];
  all_clear: boolean;
}

export async function getToday(): Promise<TodayResponse> {
  return api.get<TodayResponse>('/today');
}
