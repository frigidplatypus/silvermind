import type { SbClient } from './sb-client';
import type { Task, SpaceConfig } from './task-types';
import { toMarkdown } from './task-serializer';
import { logInfo, logError } from '$lib/helpers/logger';

export async function getInbox(_spaces: SpaceConfig[], activeSpace: SpaceConfig, sbClient: SbClient): Promise<Task[]> {
  logInfo(`Loading inbox from "${activeSpace.name}" via runtime API`);

  try {
    const runtimeTasks = await sbClient.queryTasks({});
    const tasks = runtimeTasks.map((rt: any) => ({
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

    const active = tasks.filter(t => !t.done);
    logInfo(`Inbox: ${active.length} active / ${tasks.length} total tasks`);
    return active;
  } catch (e: any) {
    logError(`Inbox load failed: ${e.message || e}`, { space: activeSpace.name });
    return [];
  }
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
