import type { SbClient } from './sb-client';
import type { Task, SpaceConfig } from './task-types';
import { parseTasksFromPage } from './task-parser';
import { toMarkdown } from './task-serializer';

export async function getInbox(spaces: SpaceConfig[], activeSpace: SpaceConfig, sbClient: SbClient): Promise<Task[]> {
  const inboxPage = activeSpace.inbox_page || 'Inbox';
  const pages = [inboxPage];

  const allTasks: Task[] = [];
  for (const page of pages) {
    try {
      const { content } = await sbClient.readPage(page);
      const tasks = parseTasksFromPage(content, page);
      allTasks.push(...tasks);
    } catch {
      // empty page or 404 — skip
    }
  }

  return allTasks.filter(t => !t.done);
}

export async function createTask(
  input: { text: string; page?: string; due?: string; deferred?: string; priority?: string; name?: string; tags?: string[] },
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
