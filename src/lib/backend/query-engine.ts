import type { Task, TaskFilter } from './task-types';
import { isBeforeToday, isToday } from './task-date';

export function resolveDateFunctions(sliq: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  let wd = now.getDay() - 1;
  if (wd < 0) wd = 6;
  const weekStart = new Date(now.getTime() - wd * 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + (6 - wd) * 86400000).toISOString().slice(0, 10);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  sliq = sliq.replace(/today\(\)/g, `"${today}"`);
  sliq = sliq.replace(/tomorrow\(\)/g, `"${tomorrow}"`);
  sliq = sliq.replace(/weekStart\(\)/g, `"${weekStart}"`);
  sliq = sliq.replace(/weekEnd\(\)/g, `"${weekEnd}"`);
  sliq = sliq.replace(/monthStart\(\)/g, `"${monthStart}"`);
  sliq = sliq.replace(/monthEnd\(\)/g, `"${monthEnd}"`);

  sliq = sliq.replace(/addDays\(([+-]?\d+)\)/g, (_: string, n: string) => {
    const d = new Date(now.getTime() + parseInt(n, 10) * 86400000);
    return `"${d.toISOString().slice(0, 10)}"`;
  });

  return sliq;
}

export function resolveRelativeDates(sliq: string): string {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);

  let wd = now.getDay() - 1;
  if (wd < 0) wd = 6;
  const weekStart = new Date(now.getTime() - wd * 86400000).toISOString().slice(0, 10);
  const weekEnd = new Date(now.getTime() + (6 - wd) * 86400000).toISOString().slice(0, 10);

  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  sliq = sliq.replace(/@today/g, today);
  sliq = sliq.replace(/@tomorrow/g, tomorrow);
  sliq = sliq.replace(/@week_start/g, weekStart);
  sliq = sliq.replace(/@week_end/g, weekEnd);
  sliq = sliq.replace(/@month_start/g, monthStart);
  sliq = sliq.replace(/@month_end/g, monthEnd);

  sliq = sliq.replace(/@([+-]\d+)/g, (_: string, n: string) => {
    const d = new Date(now.getTime() + parseInt(n, 10) * 86400000);
    return d.toISOString().slice(0, 10);
  });

  return sliq;
}

export function normalizeSLIQ(sliq: string): string {
  const lines = sliq.split('\n');
  const out: string[] = [];
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    if (line.startsWith('from ') || line.startsWith('select ')) continue;
    line = line.replace(/\bp\./g, 't.');
    line = line.replace(/\bt\.tags\b/g, 't.itags');
    out.push(line);
  }
  return out.join('\n');
}

function extractQuotedValue(s: string): string {
  const idx = s.indexOf('"');
  if (idx < 0) return '';
  const rest = s.slice(idx + 1);
  const idx2 = rest.indexOf('"');
  if (idx2 < 0) return '';
  return rest.slice(0, idx2);
}

function parseJournalDate(due: string): string | null {
  const m = due.match(/\[\[Journal\/(\d{4}-\d{2}-\d{2})\]\]/);
  if (m) return m[1];
  const d = due.match(/\d{4}-\d{2}-\d{2}/);
  return d ? d[0] : null;
}

function extractSLIQString(line: string, after: string): string {
  const idx = line.indexOf(after);
  if (idx < 0) return '';
  let rest = line.slice(idx + after.length);
  rest = rest.replace(/^[\s(",]+/, '');
  const qIdx = rest.indexOf('"');
  if (qIdx > 0) rest = rest.slice(0, qIdx);
  rest = rest.replace(/[\s")]+$/, '');
  return rest.replace(/^"(.*)"$/, '$1');
}

function parseAttrEquality(clause: string): { field: string; val: string } | null {
  const trimmed = clause.startsWith('t.') ? clause.slice(2) : clause;
  const idx = trimmed.indexOf('==');
  if (idx <= 0) return null;
  const key = trimmed.slice(0, idx).trim();
  const val = trimmed
    .slice(idx + 2)
    .trim()
    .replace(/^["']|["']$/g, '');
  return { field: key, val };
}

function defaultExcludeDone(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done && t.status !== 'x');
}

export function translateSLIQ(rawSliq: string): {
  filter: TaskFilter;
  postFilter: (tasks: Task[]) => Task[];
} {
  let sliq = resolveDateFunctions(rawSliq);
  sliq = resolveRelativeDates(sliq);
  sliq = normalizeSLIQ(sliq);

  const filter: TaskFilter = { limit: 100 };
  const pageExcludes: string[] = [];
  const pageIncludes: string[] = [];
  const clientFilters: ((tasks: Task[]) => Task[])[] = [];

  const lines = sliq.split('\n');
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line.startsWith('limit ')) {
      const n = parseInt(line.slice(6).trim(), 10);
      if (n > 0) filter.limit = n;
      continue;
    }

    if (line.startsWith('order by ')) {
      const rest = line.slice(9).trim();
      const parts = rest.split(/\s+/);
      const field = parts[0].startsWith('t.') ? parts[0].slice(2) : parts[0];
      if (['page', 'pos', 'due', 'deferred', 'priority'].includes(field)) {
        filter.sortBy = field;
        filter.sortOrder = parts[1] === 'desc' ? 'desc' : 'asc';
      }
      continue;
    }

    if (line.startsWith('where ') || line.startsWith('and ')) {
      line = line.replace(/^(where|and)\s+/, '').trim();

      const orClauses = splitOr(line);
      for (const orClause of orClauses) {
        const subClauses = orClause
          .split(/\s+and\s+/)
          .map((s) => s.trim())
          .filter(Boolean);
        let localFilters: ((tasks: Task[]) => Task[])[] = [];

        for (const sub of subClauses) {
          const clauseResult = processFilterClause(sub, filter);
          if (clauseResult) localFilters.push(...clauseResult);
        }

        if (orClauses.length > 1) {
          clientFilters.push((tasks) => {
            for (const f of localFilters) {
              const filtered = f(tasks);
              if (filtered.length > 0) return filtered;
            }
            return [] as Task[];
          });
        } else {
          clientFilters.push(...localFilters);
        }
      }
      continue;
    }
  }

  if (pageExcludes.length > 0) {
    clientFilters.push((tasks) =>
      tasks.filter((t) => !pageExcludes.some((p) => t.page.startsWith(p))),
    );
  }

  if (pageIncludes.length > 0) {
    clientFilters.push((tasks) =>
      tasks.filter((t) => pageIncludes.some((p) => t.page.startsWith(p))),
    );
  }

  const hasStatusFilter = filter.status && filter.status.length > 0;

  const postFilter = (tasks: Task[]): Task[] => {
    for (const f of clientFilters) {
      tasks = f(tasks);
    }
    if (!hasStatusFilter) {
      tasks = defaultExcludeDone(tasks);
    }
    return tasks;
  };

  return { filter, postFilter };
}

function splitOr(line: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '(') depth++;
    else if (line[i] === ')') depth--;
    else if (depth === 0 && line.slice(i).startsWith(' or ') && line[i - 1] !== '(') {
      result.push(line.slice(start, i).trim());
      start = i + 4;
      i += 3;
    }
  }
  result.push(line.slice(start).trim());
  return result;
}

function processFilterClause(
  sub: string,
  filter: TaskFilter,
): ((tasks: Task[]) => Task[])[] | null {
  if (!sub) return null;

  if (sub === 'not t.done') return null;

  if (sub === 't.done') {
    filter.status = ['x'];
    return null;
  }

  if (sub.startsWith('t.state ==')) {
    const st = sub
      .slice(10)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .toLowerCase();
    if (st === 'waiting' || st === 'x' || st === 'maybe' || st === 'someday') {
      if (!filter.status) filter.status = [];
      filter.status.push(st);
    }
    return null;
  }

  if (sub.startsWith('t.state !=')) {
    const st = sub
      .slice(11)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .toLowerCase();
    if (st) {
      return [(tasks) => tasks.filter((t) => t.status.toLowerCase() !== st)];
    }
    return null;
  }

  if (sub.includes('not table.includes(t.itags,')) {
    const tag = extractSLIQString(sub, 'not table.includes(t.itags,');
    if (tag) {
      return [
        (tasks) =>
          tasks.filter((t) => !t.tags.some((tt) => tt.toLowerCase() === tag.toLowerCase())),
      ];
    }
    return null;
  }

  if (sub.includes('table.includes(t.itags,')) {
    const tag = extractSLIQString(sub, 'table.includes(t.itags,');
    if (tag) {
      if (!filter.tags) filter.tags = [];
      filter.tags.push(tag);
    }
    return null;
  }

  if (sub.includes('not t.page:startsWith(')) {
    const prefix = extractSLIQString(sub, 'not t.page:startsWith(');
    if (prefix) {
      return [(tasks) => tasks.filter((t) => !t.page.startsWith(prefix))];
    }
    return null;
  }

  if (sub.includes('t.page:startsWith(')) {
    const prefix = extractSLIQString(sub, 't.page:startsWith(');
    if (prefix) {
      filter.page = prefix;
    }
    return null;
  }

  if (sub.startsWith('t.page ==')) {
    const page = sub
      .slice(10)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    if (page) filter.page = page;
    return null;
  }

  if (sub.startsWith('t.priority ==')) {
    const pri = sub
      .slice(14)
      .trim()
      .replace(/^"(.*)"$/, '$1')
      .toLowerCase();
    if (pri) filter.priority = pri;
    return null;
  }

  if (sub.startsWith('t.name ==')) {
    const name = sub
      .slice(10)
      .trim()
      .replace(/^"(.*)"$/, '$1');
    if (name) filter.name = name;
    return null;
  }

  if (sub.includes('t.deferred:find')) {
    const dateStr = extractSLIQString(sub, 't.deferred:find');
    if (dateStr) {
      const today = `[[Journal/${dateStr}]]`;
      return [(tasks) => tasks.filter((t) => t.deferred.includes(today))];
    }
    return null;
  }

  if (sub.includes('t.deferred') && sub.includes('<')) {
    const val = extractQuotedValue(sub);
    if (val) {
      return [
        (tasks) =>
          tasks.filter((t) => {
            if (!t.deferred) return false;
            const d = parseJournalDate(t.deferred);
            return d ? d < val : false;
          }),
      ];
    }
    return null;
  }

  if (sub.includes('t.due') && sub.includes('<')) {
    const val = extractQuotedValue(sub);
    if (val) {
      return [
        (tasks) =>
          tasks.filter((t) => {
            if (!t.due) return false;
            const d = parseJournalDate(t.due);
            return d ? d < val : false;
          }),
      ];
    }
    return null;
  }

  if (sub.includes('t.due') && sub.includes('>')) {
    const val = extractQuotedValue(sub);
    if (val) {
      return [
        (tasks) =>
          tasks.filter((t) => {
            if (!t.due) return false;
            const d = parseJournalDate(t.due);
            return d ? d > val : false;
          }),
      ];
    }
    return null;
  }

  if (sub.startsWith('t.extra_attrs.')) {
    const rest = sub.slice(14);
    const parts = rest.split(/\s+/, 2);
    const key = parts[0];
    const cond = parts[1] || '';

    if (cond.startsWith('==')) {
      const val = cond
        .slice(2)
        .trim()
        .replace(/^"(.*)"$/, '$1');
      if (val) {
        return [(tasks) => tasks.filter((t) => t.extra_attrs?.[key] === val)];
      }
    } else if (cond.startsWith('!=')) {
      const val = cond
        .slice(2)
        .trim()
        .replace(/^"(.*)"$/, '$1');
      if (val) {
        return [(tasks) => tasks.filter((t) => t.extra_attrs?.[key] !== val)];
      }
    } else if (cond === '!= nil') {
      return [(tasks) => tasks.filter((t) => t.extra_attrs && key in t.extra_attrs)];
    } else if (cond === '== nil') {
      return [(tasks) => tasks.filter((t) => !t.extra_attrs || !(key in t.extra_attrs))];
    }
    return null;
  }

  // Handle != nil / == nil for known fields
  if ((sub.includes('!=') && sub.includes('nil')) || (sub.includes('!=') && sub.includes('null'))) {
    const parts = sub.split('!=');
    if (parts.length === 2) {
      let field = parts[0].trim();
      field = field.startsWith('t.') ? field.slice(2) : field;
      if (field === 'due' || field === 'deferred' || field === 'alerts') {
        return [
          (tasks) =>
            tasks.filter((t) => {
              if (field === 'due') return !!t.due;
              if (field === 'deferred') return !!t.deferred;
              if (field === 'alerts') return t.alerts && t.alerts.length > 0;
              return false;
            }),
        ];
      }
    }
    return null;
  }

  if ((sub.includes('==') && sub.includes('nil')) || (sub.includes('==') && sub.includes('null'))) {
    const parts = sub.split('==');
    if (parts.length === 2) {
      let field = parts[0].trim();
      field = field.startsWith('t.') ? field.slice(2) : field;
      if (field === 'due' || field === 'deferred' || field === 'alerts') {
        return [
          (tasks) =>
            tasks.filter((t) => {
              if (field === 'due') return !t.due;
              if (field === 'deferred') return !t.deferred;
              if (field === 'alerts') return !t.alerts || t.alerts.length === 0;
              return true;
            }),
        ];
      }
    }
    return null;
  }

  // Bare field reference (truthy check)
  if (/^t\.[a-z]+$/.test(sub)) {
    const field = sub.slice(2);
    if (field === 'alerts') {
      return [(tasks) => tasks.filter((t) => t.alerts && t.alerts.length > 0)];
    }
    return null;
  }

  // Catch-all: t.field == "value" (custom attrs)
  const attr = parseAttrEquality(sub);
  if (attr && attr.val) {
    return [(tasks) => tasks.filter((t) => t.extra_attrs?.[attr.field] === attr.val)];
  }

  return null;
}

export function computeBlocked(tasks: Task[]): void {
  const doneNames = new Set<string>();
  for (const t of tasks) {
    if (t.done && t.name) doneNames.add(t.name);
  }
  for (const t of tasks) {
    if (t.depends_on && t.depends_on.length > 0) {
      t.blocked = t.depends_on.some((d) => !doneNames.has(d));
    } else {
      t.blocked = false;
    }
  }
}

export function applyHardExclusions(tasks: Task[]): Task[] {
  return tasks.filter((t) => {
    if (t.status === 'x') return false;
    if (t.status === 'waiting') return false;
    if (t.page.startsWith('Library/')) return false;
    if (t.tags.some((tag) => tag === 'meta' || tag.startsWith('meta/'))) return false;
    return true;
  });
}

export function excludeDone(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done && t.status !== 'waiting');
}

export function filterByTags(tasks: Task[], required: string[]): Task[] {
  return tasks.filter((t) =>
    required.every((tag) => t.tags.some((tt) => tt.toLowerCase() === tag.toLowerCase())),
  );
}

export function filterExcludeTags(tasks: Task[], exclude: string[]): Task[] {
  return tasks.filter(
    (t) => !exclude.some((tag) => t.tags.some((tt) => tt.toLowerCase() === tag.toLowerCase())),
  );
}

export function filterOverdue(tasks: Task[]): Task[] {
  return tasks.filter((t) => {
    if (!t.due) return false;
    const m = t.due.match(/\d{4}-\d{2}-\d{2}/);
    if (!m) return false;
    return isBeforeToday(m[0]) && !t.done;
  });
}

export function filterBlocked(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.blocked);
}

export function filterUnblocked(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.blocked);
}

export function filterByStatuses(tasks: Task[], statuses: string[]): Task[] {
  return tasks.filter((t) => statuses.includes(t.status));
}

export function filterByParent(tasks: Task[], parent: string): Task[] {
  return tasks.filter((t) => t.parent === parent);
}

export function filterByOrphan(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.parent);
}

export function filterByRecur(tasks: Task[]): Task[] {
  return tasks.filter((t) => !!t.recur);
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
