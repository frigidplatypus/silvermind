import type { SbClient } from './sb-client';
import type { Task, SpaceConfig } from './task-types';
import { toMarkdown } from './task-serializer';
import { logInfo, logError } from '$lib/helpers/logger';
import { applyGlobalTaskExclusions } from './query-engine';
import { mapRuntimeTask, parseTasksFromPage } from './task-parser';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (error) => {
        clearTimeout(id);
        reject(error);
      },
    );
  });
}

async function readTasksFromPage(sbClient: SbClient, page: string): Promise<Task[]> {
  const { content } = await sbClient.readPage(page);
  return parseTasksFromPage(content, page);
}

export async function loadTasks(
  activeSpace: SpaceConfig,
  sbClient: SbClient,
  runtimeTimeoutMs = 6000,
): Promise<Task[]> {
  if (runtimeTimeoutMs > 0) {
    try {
      const runtimeTasks = await withTimeout(
        sbClient.queryTasks({}),
        runtimeTimeoutMs,
        `Runtime task query for ${activeSpace.name}`,
      );
      return runtimeTasks.map(mapRuntimeTask);
    } catch (e: any) {
      logError(`Runtime task query failed; falling back to .fs pages: ${e.message || e}`, {
        space: activeSpace.name,
      });
    }
  }

  const pages = [activeSpace.default_page || 'Tasks', activeSpace.inbox_page || 'Inbox'].filter(
    (page, index, all) => page && all.indexOf(page) === index,
  );

  const results = await Promise.allSettled(pages.map((page) => readTasksFromPage(sbClient, page)));
  const tasks: Task[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') tasks.push(...result.value);
    else logError(`Fallback page task load failed: ${result.reason?.message || result.reason}`);
  }
  logInfo(`Fallback .fs task load: ${tasks.length} tasks from ${pages.length} page(s)`);
  return tasks;
}

export async function getInbox(
  _spaces: SpaceConfig[],
  activeSpace: SpaceConfig,
  sbClient: SbClient,
): Promise<Task[]> {
  logInfo(`Loading inbox from "${activeSpace.name}" via runtime API`);

  try {
    const tasks = await loadTasks(activeSpace, sbClient);

    const active = (await applyGlobalTaskExclusions(tasks, sbClient)).filter((t) => !t.done);
    logInfo(`Inbox: ${active.length} active / ${tasks.length} total tasks`);
    return active;
  } catch (e: any) {
    logError(`Inbox load failed: ${e.message || e}`, { space: activeSpace.name });
    return [];
  }
}

export async function createTask(
  input: {
    text: string;
    page?: string;
    due?: string;
    deferred?: string;
    priority?: string;
    name?: string;
    tags?: string[];
  },
  activeSpace: SpaceConfig,
  sbClient: SbClient,
): Promise<Task> {
  const inboxPage = input.page || activeSpace.inbox_page || 'Inbox';

  const task: Task = {
    page: inboxPage,
    position: 0,
    text: input.text,
    status: '',
    done: false,
    due: input.due || '',
    due_parsed: null,
    deferred: input.deferred || '',
    deferred_parsed: null,
    name: input.name || '',
    priority: input.priority || '',
    tags: input.tags || [],
    blocked: false,
  };

  const line = toMarkdown(task);

  await sbClient.readModifyWrite(inboxPage, async (content) => {
    const trimmed = content.trimEnd();
    return trimmed ? `${trimmed}\n${line}\n` : `${line}\n`;
  });

  return task;
}

export async function readModifyWriteInbox(
  page: string,
  fn: (content: string) => Promise<string>,
  sbClient: SbClient,
): Promise<void> {
  await sbClient.readModifyWrite(page, fn);
}
