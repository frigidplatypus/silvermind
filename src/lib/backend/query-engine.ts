import type { Task, TaskFilter } from './task-types';
import { isBeforeToday, isToday } from './task-date';

export function translateSLIQ(sliq: string): { filter: TaskFilter; postFilter: (tasks: Task[]) => Task[] } {
  const filter: TaskFilter = {};
  const postFilters: ((tasks: Task[]) => Task[])[] = [];

  const parts = sliq.split(/\s+/).reduce<string[]>((acc, part) => {
    if (part.match(/^(==|!=|<|>|<=|>=)$/) && acc.length > 0) {
      return [acc.slice(0, -1).join(' ') + ' ' + part + ' ' + (acc[acc.length - 1] || '')];
    }
    acc.push(part);
    return acc;
  }, ['']).filter(Boolean);

  const tokens = sliq.split(/\s+/);
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === 'sort' && i + 2 < tokens.length) {
      filter.sortBy = tokens[i + 1];
      filter.sortOrder = tokens[i + 2];
      i += 3;
      continue;
    }

    if (tok === 'limit' && i + 1 < tokens.length) {
      filter.limit = parseInt(tokens[i + 1], 10);
      i += 2;
      continue;
    }

    if (tok === 'overdue') {
      postFilters.push((tasks) => tasks.filter(t => {
        if (!t.due) return false;
        const m = t.due.match(/\d{4}-\d{2}-\d{2}/);
        if (!m) return false;
        return isBeforeToday(m[0]) && !t.done;
      }));
      i++;
      continue;
    }

    if (tok === 'blocked') {
      postFilters.push((tasks) => tasks.filter(t => t.blocked));
      i++;
      continue;
    }

    if (tok === 'unblocked') {
      postFilters.push((tasks) => tasks.filter(t => !t.blocked));
      i++;
      continue;
    }

    if (tok === 'orphan') {
      filter.orphan = true;
      i++;
      continue;
    }

    if (tok === 'recur') {
      filter.recur = true;
      i++;
      continue;
    }

    if (i + 2 < tokens.length) {
      const key = tok;
      const op = tokens[i + 1];
      const val = tokens[i + 2].replace(/^"(.*)"$/, '$1');

      switch (key) {
        case 'status':
          if (op === '==') filter.status = [val];
          if (op === '!=') postFilters.push((tasks) => tasks.filter(t => t.status !== val));
          break;
        case 'due':
          if (op === '<') filter.dueBefore = val;
          if (op === '>') filter.dueAfter = val;
          if (op === '==') {
            if (val === 'today') postFilters.push((tasks) => tasks.filter(t => {
              const m = t.due.match(/\d{4}-\d{2}-\d{2}/);
              return m ? isToday(m[0]) : false;
            }));
            else filter.dueAfter = val;
          }
          break;
        case 'deferred':
          if (op === '<' || op === '<=') filter.deferredBefore = val;
          if (op === '>') filter.deferredAfter = val;
          break;
        case 'has':
          if (!filter.tags) filter.tags = [];
          filter.tags.push(val);
          break;
        case 'exclude':
          if (!filter.excludeTags) filter.excludeTags = [];
          filter.excludeTags.push(val);
          break;
        case 'name':
          filter.name = val;
          break;
        case 'priority':
          filter.priority = val;
          break;
        case 'parent':
          filter.parent = val;
          break;
        case 'due_after':
          filter.deferredAfter = val;
          break;
      }
      i += 3;
      continue;
    }

    i++;
  }

  return {
    filter,
    postFilter: (tasks: Task[]) => {
      let result = tasks;
      for (const pf of postFilters) {
        result = pf(result);
      }
      return result;
    },
  };
}

export function computeBlocked(tasks: Task[]): void {
  const doneNames = new Set<string>();
  for (const t of tasks) {
    if (t.done && t.name) doneNames.add(t.name);
  }
  for (const t of tasks) {
    if (t.depends_on && t.depends_on.length > 0) {
      t.blocked = t.depends_on.some(d => !doneNames.has(d));
    } else {
      t.blocked = false;
    }
  }
}

export function applyHardExclusions(tasks: Task[]): Task[] {
  return tasks.filter(t => {
    if (t.status === 'x') return false;
    if (t.status === 'waiting') return false;
    return true;
  });
}

export function excludeDone(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.done && t.status !== 'waiting');
}

export function filterByTags(tasks: Task[], required: string[]): Task[] {
  return tasks.filter(t => required.every(tag => t.tags.includes(tag)));
}

export function filterExcludeTags(tasks: Task[], exclude: string[]): Task[] {
  return tasks.filter(t => !exclude.some(tag => t.tags.includes(tag)));
}

export function filterOverdue(tasks: Task[]): Task[] {
  return tasks.filter(t => {
    if (!t.due) return false;
    const m = t.due.match(/\d{4}-\d{2}-\d{2}/);
    if (!m) return false;
    return isBeforeToday(m[0]) && !t.done;
  });
}

export function filterBlocked(tasks: Task[]): Task[] {
  return tasks.filter(t => t.blocked);
}

export function filterUnblocked(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.blocked);
}

export function filterByStatuses(tasks: Task[], statuses: string[]): Task[] {
  return tasks.filter(t => statuses.includes(t.status));
}

export function filterByParent(tasks: Task[], parent: string): Task[] {
  return tasks.filter(t => t.parent === parent);
}

export function filterByOrphan(tasks: Task[]): Task[] {
  return tasks.filter(t => !t.parent);
}

export function filterByRecur(tasks: Task[]): Task[] {
  return tasks.filter(t => !!t.recur);
}

export function sortTasks(tasks: Task[], sortBy: string, order: string): void {
  const dir = order === 'desc' ? -1 : 1;
  const key = sortBy as keyof Task;
  tasks.sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  });
}

export function normalizePositions(tasks: Task[]): void {
  for (let i = 0; i < tasks.length; i++) {
    tasks[i].position = i + 1;
  }
}
