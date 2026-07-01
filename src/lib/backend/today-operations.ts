import type { SbClient } from './sb-client';
import type { Task } from './task-types';
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
  _activePage: string,
  sbClient: SbClient,
): Promise<{
  overdue: Task[];
  dueToday: Task[];
  deferredToday: Task[];
  allClear: boolean;
}> {
  const runtimeTasks = await sbClient.queryTasks({});
  const tasks: Task[] = runtimeTasks.map((rt: any) => ({
    page: rt.page || '',
    position: rt.pos || 0,
    text: rt.text || '',
    status: rt.status || '',
    done: rt.done || false,
    due: rt.due || '',
    due_parsed: rt.due_parsed || null,
    deferred: rt.deferred || '',
    deferred_parsed: rt.deferred_parsed || null,
    name: rt.name || '',
    priority: rt.priority || '',
    tags: rt.tags || [],
    parent: rt.parent,
    depends_on: rt.depends_on,
    blocked: false,
    recur: rt.recur,
    alerts: rt.alerts,
    extra_attrs: rt.extra_attrs,
  }));

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
