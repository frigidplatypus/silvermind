import type { SbClient } from './sb-client';
import type { Task } from './task-types';
import { parseTasksFromPage, findNthTask } from './task-parser';
import { toMarkdown } from './task-serializer';
import { advanceDue } from './task-date';

export async function toggleDone(task: Task, sbClient: SbClient): Promise<Task> {
  let updatedTask: Task = { ...task, status: 'x', done: true };

  await sbClient.readModifyWrite(task.page, async (content) => {
    const lines = content.split('\n');
    const found = findNthTask(content, task.position);
    if (!found) return content;

    updatedTask.text = found.task.text;
    updatedTask.position = found.task.position;

    if (task.recur) {
      const nextDue = advanceDue(task.due || new Date().toISOString().split('T')[0], task.recur);
      const nextTask: Task = {
        ...task,
        status: '',
        done: false,
        due: nextDue,
        due_parsed: null,
        deferred: '',
        deferred_parsed: null,
      };
      const nextLine = toMarkdown(nextTask);
      const doneLine = toMarkdown(updatedTask);
      lines[found.lineIndex] = doneLine;
      return [...lines, nextLine].join('\n') + '\n';
    }

    const doneLine = toMarkdown(updatedTask);
    lines[found.lineIndex] = doneLine;
    return lines.join('\n');
  });

  return updatedTask;
}

export async function toggleUndone(task: Task, sbClient: SbClient): Promise<Task> {
  const updatedTask: Task = { ...task, status: '', done: false };

  await sbClient.readModifyWrite(task.page, async (content) => {
    const found = findNthTask(content, task.position);
    if (!found) return content;

    const undoneLine = toMarkdown(updatedTask);
    const lines = content.split('\n');
    lines[found.lineIndex] = undoneLine;
    return lines.join('\n');
  });

  return updatedTask;
}

export async function modifyTask(
  task: Task,
  fields: Partial<Task>,
  sbClient: SbClient,
): Promise<Task> {
  const updatedTask: Task = { ...task, ...fields };

  await sbClient.readModifyWrite(task.page, async (content) => {
    const found = findNthTask(content, task.position);
    if (!found) return content;

    const merged: Task = { ...found.task, ...fields };
    const modifiedLine = toMarkdown(merged);
    const lines = content.split('\n');
    lines[found.lineIndex] = modifiedLine;
    return lines.join('\n');
  });

  return updatedTask;
}

export async function deleteTask(task: Task, sbClient: SbClient): Promise<void> {
  await sbClient.readModifyWrite(task.page, async (content) => {
    const found = findNthTask(content, task.position);
    if (!found) return content;

    const lines = content.split('\n');
    lines.splice(found.lineIndex, 1);
    return lines.join('\n');
  });
}

export async function archiveTasks(page: string, sbClient: SbClient): Promise<{ archived: number }> {
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
      if (line.startsWith('- [x]') || line.startsWith('- [X]') || line.startsWith('* [x]') || line.startsWith('* [X]')) {
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
