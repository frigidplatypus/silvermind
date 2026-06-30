import type { Task } from './task-types';

const TASK_LINE_RE = /^[\s]*[-*]\s*\[([^\]]*)\]\s*(.*)$/;
const ATTR_RE = /\[(\w+):\s*((?:"[^"]*")|(?:[^\]]+))\]/g;
const TAG_RE = /#([\w-]+(?:\/[\w-]+)*)/g;

function unquote(s: string): string {
  s = s.trim();
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1);
  }
  return s;
}

export function extractTags(text: string): string[] {
  const tags: string[] = [];
  let match: RegExpExecArray | null;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(text)) !== null) {
    tags.push(match[1]);
  }
  return [...new Set(tags)];
}

export function stripAttributes(text: string): string {
  return text.replace(ATTR_RE, '').replace(/\s{2,}/g, ' ').trim();
}

export function parseAttributes(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(raw)) !== null) {
    attrs[match[1]] = unquote(match[2]);
  }
  return attrs;
}

export function parseTaskLine(line: string, page: string, position: number): Task | null {
  const m = line.match(TASK_LINE_RE);
  if (!m) return null;

  const statusRaw = m[1].trim();
  const rest = m[2];

  const attrs = parseAttributes(rest);
  const text = stripAttributes(rest);

  if (!text) return null;

  const status = statusRaw === 'x' ? 'x' : statusRaw === ' ' ? '' : statusRaw === 'waiting' ? 'waiting' : statusRaw === 'maybe' ? 'maybe' : statusRaw;
  const done = status === 'x';

  const due = attrs['due'] || '';
  const deferred = attrs['deferred'] || '';
  const name = attrs['name'] || '';
  const priority = attrs['priority'] === 'high' || attrs['priority'] === 'medium' || attrs['priority'] === 'low' ? attrs['priority'] : '';
  const recur = attrs['recur'] || undefined;
  const parent = attrs['parent'] || undefined;
  const alertsStr = attrs['alerts'];
  const alerts = alertsStr ? alertsStr.split(',').map(s => s.trim()) : undefined;

  let depends_on: string[] | undefined;
  if (attrs['dependsOn']) {
    depends_on = attrs['dependsOn'].split(',').map(s => s.trim());
  }

  const knownKeys = new Set(['due', 'deferred', 'name', 'priority', 'recur', 'parent', 'alerts', 'dependsOn']);
  const extra_attrs: Record<string, string> = {};
  for (const [k, v] of Object.entries(attrs)) {
    if (!knownKeys.has(k)) {
      extra_attrs[k] = v;
    }
  }

  return {
    page,
    position,
    text,
    status,
    done,
    due,
    due_parsed: null,
    deferred,
    deferred_parsed: null,
    name,
    priority,
    tags: extractTags(text),
    parent,
    depends_on,
    blocked: false,
    recur,
    alerts,
    extra_attrs: Object.keys(extra_attrs).length > 0 ? extra_attrs : undefined,
  };
}

export function parseTasksFromPage(content: string, page: string): Task[] {
  if (!content) return [];
  const lines = content.split('\n');
  const tasks: Task[] = [];
  let skipArchive = false;

  for (const line of lines) {
    if (line.trim() === '## Task Archive') {
      skipArchive = true;
      continue;
    }
    if (skipArchive && line.startsWith('#')) {
      skipArchive = false;
      continue;
    }
    if (skipArchive) continue;

    const task = parseTaskLine(line, page, tasks.length + 1);
    if (task) {
      tasks.push(task);
    }
  }

  return tasks;
}

export function findNthTask(content: string, n: number): { line: string; lineIndex: number; task: Task } | null {
  const lines = content.split('\n');
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const task = parseTaskLine(lines[i], '', taskIndex + 1);
    if (task) {
      taskIndex++;
      if (taskIndex === n) {
        return { line: lines[i], lineIndex: i, task };
      }
    }
  }

  return null;
}
