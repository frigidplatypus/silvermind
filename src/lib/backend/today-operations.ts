import type { SbClient } from './sb-client';
import type { Task } from './task-types';
import { parseTasksFromPage } from './task-parser';
import { isBeforeToday, isToday } from './task-date';

function extractDateFromDue(due: string): string | null {
  if (!due) return null;
  const m = due.match(/\[\[Journal\/(\d{4}-\d{2}-\d{2})\]\]/);
  if (m) return m[1];
  const d = due.match(/\d{4}-\d{2}-\d{2}/);
  if (d) return d[0];
  return null;
}

export async function getToday(
  activePage: string,
  sbClient: SbClient,
): Promise<{
  overdue: Task[];
  dueToday: Task[];
  deferredToday: Task[];
  allClear: boolean;
}> {
  const { content } = await sbClient.readPage(activePage);
  const tasks = parseTasksFromPage(content, activePage);
  const active = tasks.filter(t => !t.done && t.status !== 'waiting');

  const overdue: Task[] = [];
  const dueToday: Task[] = [];
  const deferredToday: Task[] = [];

  for (const task of active) {
    const dueDate = extractDateFromDue(task.due);
    if (dueDate && isBeforeToday(dueDate)) {
      overdue.push(task);
    } else if (dueDate && isToday(dueDate)) {
      dueToday.push(task);
    }

    const deferredDate = extractDateFromDue(task.deferred);
    if (deferredDate && isToday(deferredDate)) {
      deferredToday.push(task);
    }
  }

  return {
    overdue,
    dueToday,
    deferredToday,
    allClear: overdue.length === 0 && dueToday.length === 0 && deferredToday.length === 0,
  };
}
