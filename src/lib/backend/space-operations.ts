import { getConfigManager } from './backend-context';
import type { SpaceConfig } from './task-types';

export async function listSpaces(): Promise<SpaceConfig[]> {
  const cm = getConfigManager();
  return cm.getSpaces();
}

export async function addSpace(
  name: string,
  url: string,
  defaultPage?: string,
  inboxPage?: string,
  authToken?: string,
  defaultExcludeTags: string[] = [],
): Promise<SpaceConfig[]> {
  const cm = getConfigManager();
  await cm.load();
  return cm.addSpace(name, url, defaultPage, inboxPage, authToken, defaultExcludeTags);
}

export async function verifySpace(url: string, authToken?: string): Promise<{ ok: boolean; task_count?: number; error?: string }> {
  try {
    const { createSbClient } = await import('./sb-client');
    const client = createSbClient({ spaceURL: url, authToken });
    const tasks = await client.queryTasks({ limit: '1' });
    return { ok: true, task_count: tasks.length };
  } catch (e: any) {
    return { ok: false, error: e.message || String(e) };
  }
}

export async function setActive(name: string): Promise<SpaceConfig[]> {
  const cm = getConfigManager();
  await cm.load();
  return cm.setActiveSpace(name);
}

export async function removeSpace(name: string): Promise<SpaceConfig[]> {
  const cm = getConfigManager();
  await cm.load();
  return cm.removeSpace(name);
}
