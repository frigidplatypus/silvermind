import type { Task, TaskFilter } from './task-types';
import type { SbClient } from './sb-client';
import { isBeforeToday, isToday } from './task-date';
import * as yaml from 'js-yaml';

const excludedPageCache = new Map<string, boolean>();

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

function buildStatusOnlyFilter(
  line: string,
): { filter: (tasks: Task[]) => Task[]; includesDone: boolean } | null {
  const normalized = line
    .trim()
    .replace(/^(where|and)\s+/, '')
    .trim();
  if (!normalized) return null;

  const stripped = normalized
    .replace(/[()]/g, ' ')
    .replace(/\b(and|or)\b/g, ' ')
    .replace(/\bnot\s+t\.done\b/g, ' ')
    .replace(/\bt\.done\b/g, ' ')
    .replace(/\bt\.state\s*==\s*"[^"]*"/g, ' ')
    .replace(/\bt\.state\s*!=\s*"[^"]*"/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped) return null;

  const includeStatuses = new Set<string>();
  const excludeStatuses = new Set<string>();

  const includeDone = /\bt\.done\b/.test(normalized.replace(/\bnot\s+t\.done\b/g, ''));
  const excludeDone = /\bnot\s+t\.done\b/.test(normalized);
  if (includeDone) includeStatuses.add('x');
  if (excludeDone) excludeStatuses.add('x');

  for (const match of normalized.matchAll(/\bt\.state\s*==\s*"([^"]+)"/g)) {
    const st = match[1].toLowerCase();
    if (st === 'waiting' || st === 'x' || st === 'maybe' || st === 'someday') {
      includeStatuses.add(st);
    }
  }
  for (const match of normalized.matchAll(/\bt\.state\s*!=\s*"([^"]+)"/g)) {
    const st = match[1].toLowerCase();
    if (st === 'waiting' || st === 'x' || st === 'maybe' || st === 'someday') {
      excludeStatuses.add(st);
    }
  }

  return {
    includesDone: includeStatuses.has('x'),
    filter: (tasks: Task[]): Task[] =>
      tasks.filter((task) => {
        const status = task.status.toLowerCase();
        const done = task.done || status === 'x';

        if (includeStatuses.size > 0) {
          const matchesInclude = [...includeStatuses].some((st) =>
            st === 'x' ? done : status === st,
          );
          if (!matchesInclude) return false;
        }

        if (!includeStatuses.has('x') && excludeStatuses.has('x') && done) return false;
        if ([...excludeStatuses].some((st) => st !== 'x' && status === st)) return false;

        return true;
      }),
  };
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
  let includesDone = false;

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

      const statusFilter = buildStatusOnlyFilter(line);
      if (statusFilter) {
        clientFilters.push(statusFilter.filter);
        includesDone ||= statusFilter.includesDone;
        continue;
      }

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

  if (filter.status && filter.status.includes('x')) {
    includesDone = true;
  }

  const postFilter = (tasks: Task[]): Task[] => {
    for (const f of clientFilters) {
      tasks = f(tasks);
    }
    if (!includesDone) {
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

  if (sub === 'overdue') {
    return [(tasks) => filterOverdue(tasks)];
  }

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
      filter.deferredBefore = val;
      return null;
    }
    return null;
  }

  if (sub.includes('t.due') && sub.includes('<')) {
    const val = extractQuotedValue(sub);
    if (val) {
      filter.dueBefore = val;
      return null;
    }
    return null;
  }

  if (sub.includes('t.due') && sub.includes('>')) {
    const val = extractQuotedValue(sub);
    if (val) {
      filter.dueAfter = val;
      return null;
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

// FUTURE: task dependencies & blocking
// computeBlocked moved to FUTURE section
// filterBlocked, filterUnblocked, filterByOrphan, filterByRecur moved to FUTURE section

export function applyHardExclusions(tasks: Task[]): Task[] {
  return tasks.filter((t) => {
    if (t.status === 'x') return false;
    if (t.status === 'waiting') return false;
    if (t.page.startsWith('Library/')) return false;
    if (t.tags.some((tag) => tag === 'meta' || tag.startsWith('meta/'))) return false;
    return true;
  });
}

function normalizeTag(tag: string): string {
  return tag.trim().replace(/^#/, '').toLowerCase();
}

function hasExcludedTag(tags: string[]): boolean {
  return tags.some((tag) => {
    const normalized = normalizeTag(tag);
    return normalized === 'meta' || normalized.startsWith('meta/');
  });
}

function hasAnyTag(tags: string[], expected: string[]): boolean {
  const normalizedExpected = expected.map(normalizeTag).filter(Boolean);
  return tags.some((tag) => normalizedExpected.includes(normalizeTag(tag)));
}

function extractPageTags(content: string): string[] {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fmMatch) return [];

  try {
    const parsed = yaml.load(fmMatch[1]) as Record<string, unknown> | null;
    const rawTags = parsed?.tags;
    if (Array.isArray(rawTags)) {
      return rawTags.map((tag) => String(tag));
    }
    if (typeof rawTags === 'string') {
      return rawTags.split(/[\s,]+/).filter(Boolean);
    }
  } catch {
    return [];
  }

  return [];
}

async function isExcludedPage(page: string, sbClient: SbClient): Promise<boolean> {
  if (page.startsWith('Library/')) return true;

  const cacheKey = `${sbClient.getBaseURL()}::${page}`;
  const cached = excludedPageCache.get(cacheKey);
  if (cached != null) return cached;

  try {
    const { content } = await sbClient.readPage(page);
    const excluded = hasExcludedTag(extractPageTags(content));
    excludedPageCache.set(cacheKey, excluded);
    return excluded;
  } catch {
    excludedPageCache.set(cacheKey, false);
    return false;
  }
}

export async function applyGlobalTaskExclusions(
  tasks: Task[],
  sbClient: SbClient,
): Promise<Task[]> {
  const filteredTasks = applyHardExclusions(tasks);
  const uniquePages = [...new Set(filteredTasks.map((task) => task.page).filter(Boolean))];
  const excludedPages = new Set<string>();

  await Promise.all(
    uniquePages.map(async (page) => {
      if (await isExcludedPage(page, sbClient)) {
        excludedPages.add(page);
      }
    }),
  );

  return filteredTasks.filter((task) => !excludedPages.has(task.page));
}

export async function applyDefaultViewExclusions(
  tasks: Task[],
  sbClient: SbClient,
  excludeTags: string[] = [],
): Promise<Task[]> {
  const normalizedExcludeTags = excludeTags.map(normalizeTag).filter(Boolean);
  if (normalizedExcludeTags.length === 0) return tasks;

  const filteredTasks = filterExcludeTags(tasks, normalizedExcludeTags);
  const uniquePages = [...new Set(filteredTasks.map((task) => task.page).filter(Boolean))];
  const excludedPages = new Set<string>();

  await Promise.all(
    uniquePages.map(async (page) => {
      try {
        const { content } = await sbClient.readPage(page);
        if (hasAnyTag(extractPageTags(content), normalizedExcludeTags)) {
          excludedPages.add(page);
        }
      } catch {
        /* Keep tasks visible if page metadata cannot be read. */
      }
    }),
  );

  return filteredTasks.filter((task) => !excludedPages.has(task.page));
}

export function excludeDone(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done && t.status !== 'waiting');
}

export function filterByTags(tasks: Task[], required: string[]): Task[] {
  const normalizedRequired = required.map(normalizeTag).filter(Boolean);
  return tasks.filter((t) =>
    normalizedRequired.every((tag) => t.tags.some((tt) => normalizeTag(tt) === tag)),
  );
}

export function filterExcludeTags(tasks: Task[], exclude: string[]): Task[] {
  const normalizedExclude = exclude.map(normalizeTag).filter(Boolean);
  return tasks.filter(
    (t) => !normalizedExclude.some((tag) => t.tags.some((tt) => normalizeTag(tt) === tag)),
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

export function filterByStatuses(tasks: Task[], statuses: string[]): Task[] {
  return tasks.filter((t) => statuses.includes(t.status));
}

export function filterByParent(tasks: Task[], parent: string): Task[] {
  return tasks.filter((t) => t.parent === parent);
}

// FUTURE: task dependencies & blocking
// export function filterBlocked(tasks: Task[]): Task[] {
//   return tasks.filter((t) => t.blocked);
// }
// export function filterUnblocked(tasks: Task[]): Task[] {
//   return tasks.filter((t) => !t.blocked);
// }
// export function filterByOrphan(tasks: Task[]): Task[] {
//   return tasks.filter((t) => !t.parent);
// }
// export function filterByRecur(tasks: Task[]): Task[] {
//   return tasks.filter((t) => !!t.recur);
// }

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
