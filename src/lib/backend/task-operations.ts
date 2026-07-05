import type { SbClient } from './sb-client';
import type { Task } from './task-types';
import { parseTasksFromPage, findNthTask, findTaskByContent } from './task-parser';
import { toMarkdown } from './task-serializer';
import { advanceDue, todayString } from './task-date';
import { parseJournalLink } from './task-serializer';
import { extractTags, stripTags } from './task-parser';
import { logInfo, logWarn, logError } from '$lib/helpers/logger';

export class TaskOperationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'TaskOperationError';
    this.code = code;
  }
}

const RECUR_RE = /^(daily|weekly|monthly|yearly):\d+$/;
const ALERT_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
const TAG_RE = /^[\w-]+(?:\/[\w-]+)*$/;
const VALID_PRIORITIES = new Set(['high', 'medium', 'low']);

function validateTask(task: Task, field?: string): void {
  if (task.status.includes(':')) {
    throw new TaskOperationError(
      'VALIDATION_ERROR',
      `invalid status${field ? ` (${field})` : ''}: status must not contain ':'`,
    );
  }
  if (task.priority && !VALID_PRIORITIES.has(task.priority)) {
    throw new TaskOperationError(
      'VALIDATION_ERROR',
      `invalid priority${field ? ` (${field})` : ''}: must be high, medium, or low`,
    );
  }
  if (task.recur && !RECUR_RE.test(task.recur)) {
    throw new TaskOperationError(
      'VALIDATION_ERROR',
      `invalid recur${field ? ` (${field})` : ''}: must be daily:N, weekly:N, monthly:N, or yearly:N`,
    );
  }
  if (task.tags) {
    for (const tag of task.tags) {
      if (!TAG_RE.test(tag)) {
        throw new TaskOperationError(
          'VALIDATION_ERROR',
          `invalid tag${field ? ` (${field})` : ''}: "${tag}" must contain only word chars, hyphens, or '/' for hierarchy`,
        );
      }
    }
  }
  if (task.alerts && task.alerts.length > 0) {
    for (const alert of task.alerts) {
      if (!ALERT_RE.test(alert)) {
        throw new TaskOperationError(
          'VALIDATION_ERROR',
          `invalid alert format${field ? ` (${field})` : ''}: "${alert}" expected YYYY-MM-DD HH:MM`,
        );
      }
      const [datePart, timePart] = alert.split(' ');
      const d = new Date(datePart + 'T' + timePart + ':00');
      if (isNaN(d.getTime())) {
        throw new TaskOperationError(
          'VALIDATION_ERROR',
          `invalid alert date/time${field ? ` (${field})` : ''}: "${alert}" is not a real date/time`,
        );
      }
    }
  }
}

function extractLineStatus(line: string): string {
  const m = line.match(/^[\s]*[-*]\s*\[([^\]]*)\]/);
  return m ? m[1].trim().toLowerCase() : '';
}

function extractLineText(line: string): string {
  return line.replace(/^[\s]*[-*]\s*\[[^\]]*\]\s*/, '');
}

function verifyTextMatch(line: string, taskText: string): boolean {
  if (!taskText) return true;
  const lineText = extractLineText(line);
  const clean = lineText
    .replace(/#[\w-]+(?:\/[\w-]+)*/g, '')
    .replace(/\[(\w+):\s*(?:"[^"]*"|(?:\[\[[^\]]+\]\]|[^\[\]]+)+)\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return clean.includes(taskText);
}

function guardWrongTask(line: string, task: Task): string | null {
  const lineStatus = extractLineStatus(line);
  const expectedStatus = (task.status || '').toLowerCase();

  if (lineStatus !== expectedStatus) {
    if (verifyTextMatch(line, task.text)) {
      return null;
    }
    return `position ${task.position} on "${task.page}": expected status [${expectedStatus}], found [${lineStatus}]`;
  }

  if (task.text && !verifyTextMatch(line, task.text)) {
    return `position ${task.position} on "${task.page}": task text does not match line content`;
  }

  return null;
}

function describeTask(task: Task): string {
  return `space="${task._spaceName ?? ''}" url="${task._spaceUrl ?? ''}" page="${task.page}" pos=${task.position} status="${task.status}" done=${task.done} text="${(task.text || '').slice(0, 120)}"`;
}

export async function toggleDone(task: Task, sbClient: SbClient): Promise<Task> {
  logInfo(
    `[task-op] toggleDone start — ${describeTask(task)} client="${sbClient.getBaseURL()}"`,
  );
  let updatedTask: Task = { ...task, status: 'x', done: true };
  let notFound = false;
  let abortReason: string | null = null;
  let changed = false;

  await sbClient.readModifyWrite(task.page, async (content) => {
    logInfo(`[task-op] toggleDone — read ${content.length} bytes from "${task.page}"`);
    const found = findTaskByContent(content, task);
    if (!found) {
      logWarn(
        `[task-op] toggleDone not found — ${describeTask(task)}`,
      );
      notFound = true;
      return content;
    }

    logInfo(
      `[task-op] toggleDone resolved — targetPos=${task.position} foundPos=${found.task.position} lineIndex=${found.lineIndex} foundStatus="${found.task.status}" foundDone=${found.task.done} foundText="${found.task.text.slice(0, 120)}" raw="${found.line.slice(0, 180)}"`,
    );

    const reason = guardWrongTask(found.line, task);
    if (reason) {
      logWarn(`[task-op] toggleDone aborted — ${reason}`);
      abortReason = reason;
      return content;
    }

    const originalLine = found.line;
    const doneLine = originalLine.replace(/^(\s*[-*]\s*)\[([^\]]*)\]/, '$1[x]');
    logInfo(
      `[task-op] toggleDone — line changed: "${originalLine.slice(0, 40)}" → "${doneLine.slice(0, 40)}"`,
    );

    updatedTask = { ...found.task, status: 'x', done: true };
    changed = true;

    if (found.task.recur) {
      const dueStr = found.task.due || todayString();
      const jl = parseJournalLink(dueStr);
      const dateStr = jl ? jl.date : dueStr.replace(/[\[\]"]/g, '');
      const baseDate = new Date(dateStr + 'T00:00:00');
      const nextDue = advanceDue(dateStr, found.task.recur, baseDate);
      const nextTask: Task = {
        ...found.task,
        status: '',
        done: false,
        due: `[[Journal/${nextDue}]]`,
        due_parsed: null,
        deferred: '',
        deferred_parsed: null,
        alerts: undefined,
      };
      const nextLine = toMarkdown(nextTask);
      const lines = content.split('\n');
      lines[found.lineIndex] = doneLine;
      if (lines[lines.length - 1] === '') lines.pop();
      return [...lines, nextLine, ''].join('\n');
    }

    const lines = content.split('\n');
    lines[found.lineIndex] = doneLine;
    return lines.join('\n');
  });

  if (notFound) {
    throw new TaskOperationError(
      'NOT_FOUND',
      `task not found on page "${task.page}" at position ${task.position} with text "${task.text}"`,
    );
  }

  if (abortReason) {
    throw new TaskOperationError('WRONG_TASK', abortReason);
  }

  if (!changed) {
    throw new TaskOperationError(
      'NO_CHANGE',
      `task was not changed on page "${task.page}" at position ${task.position}`,
    );
  }

  logInfo(
    `[task-op] toggleDone complete — page="${task.page}" targetPos=${task.position} updatedPos=${updatedTask.position} status="${updatedTask.status}"`,
  );
  return updatedTask;
}

export async function toggleUndone(task: Task, sbClient: SbClient): Promise<Task> {
  logInfo(
    `[task-op] toggleUndone start — ${describeTask(task)} client="${sbClient.getBaseURL()}"`,
  );
  const updatedTask: Task = { ...task, status: '', done: false };
  let notFound = false;
  let abortReason: string | null = null;
  let changed = false;

  await sbClient.readModifyWrite(task.page, async (content) => {
    const found = findTaskByContent(content, task);
    if (!found) {
      logWarn(`[task-op] toggleUndone not found — ${describeTask(task)}`);
      notFound = true;
      return content;
    }

    logInfo(
      `[task-op] toggleUndone resolved — targetPos=${task.position} foundPos=${found.task.position} lineIndex=${found.lineIndex} foundStatus="${found.task.status}" foundDone=${found.task.done} foundText="${found.task.text.slice(0, 120)}" raw="${found.line.slice(0, 180)}"`,
    );

    const lineStatus = extractLineStatus(found.line);
    if (!lineStatus || 'x' !== lineStatus) {
      abortReason = `line at position ${task.position} on "${task.page}" is not done (status: [${lineStatus}])`;
      logWarn(`[task-op] toggleUndone aborted — ${abortReason}`);
      return content;
    }

    const originalLine = found.line;
    const undoneLine = originalLine.replace(/^(\s*[-*]\s*)\[x\]/i, '$1[ ]');

    const lines = content.split('\n');
    lines[found.lineIndex] = undoneLine;
    changed = true;

    if (task.recur) {
      const tasks = parseTasksFromPage(content, task.page);
      for (let i = tasks.length - 1; i >= 0; i--) {
        const t = tasks[i];
        if (t.recur === task.recur && !t.done) {
          if (task.name && t.name !== task.name) continue;
          if (!task.name && t.text !== task.text) continue;
          const matchFound = findTaskByContent(content, t);
          if (matchFound) {
            lines.splice(matchFound.lineIndex, 1);
          }
          break;
        }
      }
    }

    return lines.join('\n');
  });

  if (notFound || abortReason || !changed) {
    logWarn(
      `[task-op] toggleUndone no-op — page="${task.page}" pos=${task.position} notFound=${notFound} abortReason="${abortReason ?? ''}" changed=${changed}`,
    );
    return updatedTask;
  }

  logInfo(`[task-op] toggleUndone complete — page="${task.page}" pos=${task.position}`);
  return updatedTask;
}

export async function modifyTask(
  task: Task,
  fields: Partial<Task>,
  sbClient: SbClient,
): Promise<Task> {
  if (fields.status !== undefined) {
    validateTask({ ...task, status: fields.status } as Task, 'status');
  }
  if (fields.priority !== undefined) {
    validateTask({ ...task, priority: fields.priority } as Task, 'priority');
  }
  if (fields.recur !== undefined) {
    validateTask({ ...task, recur: fields.recur } as Task, 'recur');
  }
  if (fields.tags !== undefined) {
    validateTask({ ...task, tags: fields.tags } as Task, 'tags');
  }
  if (fields.alerts !== undefined) {
    validateTask({ ...task, alerts: fields.alerts } as Task, 'alerts');
  }

  let updatedTask: Task = { ...task, ...fields };

  await sbClient.readModifyWrite(task.page, async (content) => {
    const found = findTaskByContent(content, task);
    if (!found) return content;

    const reason = guardWrongTask(found.line, task);
    if (reason) {
      logWarn(`[task-op] modifyTask aborted — ${reason}`);
      return content;
    }

    const merged: Task = { ...found.task, ...fields };

    if (fields.status !== undefined) {
      merged.done = merged.status === 'x';
    }
    if (fields.tags !== undefined) {
      let txt = stripTags(merged.text);
      if (fields.tags.length > 0) {
        const tagStr = fields.tags.map((t) => `#${t}`).join(' ');
        txt = `${txt} ${tagStr}`.trim();
      }
      merged.text = txt;
    }

    const modifiedLine = toMarkdown(merged);
    const lines = content.split('\n');
    lines[found.lineIndex] = modifiedLine;

    updatedTask = merged;
    return lines.join('\n');
  });

  return updatedTask;
}

export async function deleteTask(task: Task, sbClient: SbClient): Promise<void> {
  await sbClient.readModifyWrite(task.page, async (content) => {
    const found = findTaskByContent(content, task);
    if (!found) return content;

    const lines = content.split('\n');
    lines.splice(found.lineIndex, 1);
    return lines.join('\n');
  });
}

export async function archiveTasks(
  page: string,
  sbClient: SbClient,
): Promise<{ archived: number }> {
  let count = 0;

  await sbClient.readModifyWrite(page, async (content) => {
    const lines = content.split('\n');
    const activeLines: string[] = [];
    const doneLines: string[] = [];
    let inArchive = false;
    let archiveHeaderFound = false;

    for (const line of lines) {
      if (line.trim() === '## Task Archive') {
        inArchive = true;
        archiveHeaderFound = true;
      }
      if (
        line.startsWith('- [x]') ||
        line.startsWith('- [X]') ||
        line.startsWith('* [x]') ||
        line.startsWith('* [X]')
      ) {
        if (!inArchive) {
          doneLines.push(line);
          count++;
        } else {
          activeLines.push(line);
        }
      } else {
        activeLines.push(line);
      }
    }

    let result = activeLines.join('\n');
    if (!archiveHeaderFound && doneLines.length > 0) {
      result = result.trimEnd() + '\n\n## Task Archive\n' + doneLines.join('\n') + '\n';
    } else if (archiveHeaderFound) {
      result = result.trimEnd() + '\n' + doneLines.join('\n') + '\n';
    }

    return result;
  });

  return { archived: count };
}
