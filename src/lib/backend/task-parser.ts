import type { Task } from './task-types';
import { logInfo, logWarn } from '$lib/helpers/logger';

const TASK_LINE_RE = /^[\s]*[-*]\s*\[([^\]]*)\]\s*(.*)$/;
const ATTR_RE = /\[(\w+):\s*((?:"[^"]*")|(?:(?:\[\[[^\]]+\]\]|[^\[\]]+)+))\]/g;
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
  return text
    .replace(ATTR_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function stripTags(text: string): string {
  return text
    .replace(TAG_RE, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function collectExtraAttrs(rt: Record<string, unknown>): Record<string, unknown> {
  const known = new Set([
    'ref',
    'tag',
    'name',
    'done',
    'state',
    'page',
    'pos',
    'parent',
    'tags',
    'itags',
    'due',
    'deferred',
    'priority',
    'recur',
    'alerts',
    'depends_on',
    'due_parsed',
    'deferred_parsed',
    'text',
    'range',
    'toPos',
    'pageLastModified',
  ]);
  const extra: Record<string, unknown> = {};
  for (const key of Object.keys(rt)) {
    if (!known.has(key)) {
      extra[key] = rt[key];
    }
  }
  return extra;
}

export function mapRuntimeTask(rt: Record<string, any>): Task {
  const rawText = rt.text || rt.name || '';
  const stripped = stripAttributes(rawText);
  const text = stripTags(stripped);
  return {
    page: rt.page || '',
    position: rt.pos || 0,
    text,
    status: (rt.state || '').toLowerCase(),
    done: rt.done || false,
    due: rt.due || '',
    due_parsed: rt.due_parsed || null,
    deferred: rt.deferred || '',
    deferred_parsed: rt.deferred_parsed || null,
    name: rt.name || '',
    priority: rt.priority || '',
    tags: rt.tags || extractTags(stripped),
    parent: rt.parent,
    depends_on: rt.depends_on,
    blocked: false,
    recur: rt.recur,
    alerts: rt.alerts,
    extra_attrs: rt.extra_attrs || collectExtraAttrs(rt),
  };
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
  const rawText = stripAttributes(rest);
  const tags = extractTags(rawText);
  const text = stripTags(rawText);

  if (!text) return null;

  const status =
    statusRaw === 'x'
      ? 'x'
      : statusRaw === ' '
        ? ''
        : statusRaw === 'waiting'
          ? 'waiting'
          : statusRaw === 'maybe'
            ? 'maybe'
            : statusRaw;
  const done = status === 'x';

  const due = attrs['due'] || '';
  const deferred = attrs['deferred'] || '';
  const name = attrs['name'] || '';
  const priority =
    attrs['priority'] === 'high' || attrs['priority'] === 'medium' || attrs['priority'] === 'low'
      ? attrs['priority']
      : '';
  const recur = attrs['recur'] || undefined;
  const parent = attrs['parent'] || undefined;
  const alertsStr = attrs['alerts'];
  const alerts = alertsStr ? alertsStr.split(',').map((s) => s.trim()) : undefined;

  let depends_on: string[] | undefined;
  if (attrs['dependsOn']) {
    depends_on = attrs['dependsOn'].split(',').map((s) => s.trim());
  }

  const knownKeys = new Set([
    'due',
    'deferred',
    'name',
    'priority',
    'recur',
    'parent',
    'alerts',
    'dependsOn',
  ]);
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
    tags,
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

export function findNthTask(
  content: string,
  n: number,
): { line: string; lineIndex: number; task: Task } | null {
  const lines = content.split('\n');
  let taskIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const rawMatch = lines[i].match(TASK_LINE_RE);
    if (!rawMatch) continue;
    taskIndex++;
    if (taskIndex === n) {
      const task = parseTaskLine(lines[i], '', n);
      return {
        line: lines[i],
        lineIndex: i,
        task: task || {
          page: '',
          position: n,
          text: '',
          status: '',
          done: false,
          tags: [],
          blocked: false,
          due: '',
          due_parsed: null,
          deferred: '',
          deferred_parsed: null,
          name: '',
          priority: '',
          extra_attrs: {},
        },
      };
    }
  }

  return null;
}

export function findTaskByContent(
  content: string,
  targetTask: Task,
): { line: string; lineIndex: number; task: Task } | null {
  const lines = content.split('\n');
  const targetText = (targetTask.text || '').trim();
  const targetStatus = (targetTask.status || '').toLowerCase();
  const targetPosition = targetTask.position || 0;
  let taskPosition = 0;
  let sourceOffset = 0;
  let skipArchive = false;
  let sawExactSourceOffset = false;

  logInfo(
    `[task-parser] resolving task — page="${targetTask.page}" targetPos=${targetPosition} targetStatus="${targetStatus}" targetText="${targetText.slice(0, 120)}" lines=${lines.length}`,
  );

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineStartOffset = sourceOffset;
    sourceOffset += line.length + 1;

    if (line.trim() === '## Task Archive') {
      skipArchive = true;
      continue;
    }
    if (skipArchive && line.startsWith('#')) {
      skipArchive = false;
    }
    if (skipArchive) continue;

    const rawMatch = line.match(TASK_LINE_RE);
    if (!rawMatch) continue;
    taskPosition++;

    const task = parseTaskLine(line, targetTask.page, taskPosition);
    if (!task) continue;

    const lineText = task.text.trim();
    const lineStatus = task.status.toLowerCase();

    if (targetPosition > 0) {
      if (lineStartOffset === targetPosition) {
        sawExactSourceOffset = true;
        if (lineText === targetText || !targetText) {
          logInfo(
            `[task-parser] matched by source offset — page="${targetTask.page}" targetPos=${targetPosition} taskOrdinal=${taskPosition} lineIndex=${i} lineStatus="${lineStatus}" lineText="${lineText.slice(0, 120)}"`,
          );
          return {
            line,
            lineIndex: i,
            task,
          };
        }
        logWarn(
          `[task-parser] source offset matched but text differed — page="${targetTask.page}" targetPos=${targetPosition} taskOrdinal=${taskPosition} lineIndex=${i} expected="${targetText.slice(0, 120)}" actual="${lineText.slice(0, 120)}" actualStatus="${lineStatus}"`,
        );
        return null;
      }
    }

    if (targetPosition > 0) {
      if (taskPosition !== targetPosition) continue;
      if (lineText === targetText || !targetText) {
        logInfo(
          `[task-parser] matched by ordinal position — page="${targetTask.page}" targetPos=${targetPosition} lineIndex=${i} lineStatus="${lineStatus}" lineText="${lineText.slice(0, 120)}"`,
        );
        return {
          line,
          lineIndex: i,
          task,
        };
      }
      logWarn(
        `[task-parser] position matched but text differed — page="${targetTask.page}" targetPos=${targetPosition} lineIndex=${i} expected="${targetText.slice(0, 120)}" actual="${lineText.slice(0, 120)}" actualStatus="${lineStatus}"`,
      );
      return null;
    }

    if (lineText === targetText && lineStatus === targetStatus) {
      logInfo(
        `[task-parser] matched by text/status — page="${targetTask.page}" lineIndex=${i} taskPos=${taskPosition} status="${lineStatus}" text="${lineText.slice(0, 120)}"`,
      );
      return {
        line,
        lineIndex: i,
        task,
      };
    }
  }

  logWarn(
    `[task-parser] no match — page="${targetTask.page}" targetPos=${targetPosition} scannedTasks=${taskPosition} sawExactSourceOffset=${sawExactSourceOffset} targetStatus="${targetStatus}" targetText="${targetText.slice(0, 120)}"`,
  );
  return null;
}
