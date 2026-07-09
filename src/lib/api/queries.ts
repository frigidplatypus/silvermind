import { getSbClient, getSpaceConfig, setSpaceConfig } from '$lib/backend/backend-context';
import { getQueryPages, executeQueryBlock, saveQueryBlock } from '$lib/backend/query-operations';
import { executeQuery } from '$lib/backend/query-operations';
import { extractQueryBlocks } from '$lib/backend/query-operations';
import {
  ensureSpaceConfig,
  isFavorite,
  toggleFavorite,
  writeSpaceConfig,
  readSpaceConfig,
} from '$lib/backend/space-config';
import type { FavoriteQuery } from '$lib/backend/task-types';
import type { Task } from '$lib/types/task';
import { logInfo, logError } from '$lib/helpers/logger';

export interface QueryPage {
  page: string;
  block_count: number;
  blocks: QueryBlockInfo[];
  errors?: string[];
}

export interface QueryBlockInfo {
  title: string;
  number: number;
  sliq: string;
}

export interface QueryExecuteResult {
  title: string;
  sliq?: string;
  tasks: Task[];
}

export async function getQueryPagesFn(tag?: string, refresh = false): Promise<QueryPage[]> {
  logInfo(`[queries-api] getQueryPagesFn called (tag=${tag}, refresh=${refresh})`);
  let sbClient;
  try {
    sbClient = await getSbClient();
    logInfo(`[queries-api] got SB client (baseURL=${sbClient.getBaseURL()})`);
  } catch (e) {
    logError('[queries-api] failed to get SB client:', e);
    throw e;
  }
  const pages = await getQueryPages(sbClient);
  logInfo(`[queries-api] got ${pages.length} pages from getQueryPages`);
  return pages.map((p) => ({
    page: p.page,
    block_count: p.blocks.length,
    blocks: p.blocks.map((b) => ({ title: b.title, number: b.number, sliq: b.sliq })),
  }));
}
export { getQueryPagesFn as getQueryPages };

export async function getQueryBlocks(page: string): Promise<QueryBlockInfo[]> {
  const sbClient = await getSbClient();
  const { content } = await sbClient.readPage(page);
  const blocks = extractQueryBlocks(content);
  return blocks.map((b) => ({ title: b.title, number: b.number, sliq: b.sliq }));
}

export async function executeQueryFn(page: string, index?: number): Promise<QueryExecuteResult[]> {
  const sbClient = await getSbClient();
  if (index) {
    const tasks = await executeQueryBlock(page, index, sbClient);
    return [{ title: `Query ${index}`, tasks: tasks as Task[] }];
  }
  const { content } = await sbClient.readPage(page);
  const blocks = extractQueryBlocks(content);
  const results: QueryExecuteResult[] = [];
  for (const block of blocks) {
    const tasks = await executeQuery(block.sliq, sbClient);
    results.push({ title: block.title, sliq: block.sliq, tasks: tasks as Task[] });
  }
  return results;
}
export { executeQueryFn as executeQuery };

export interface SaveQueryRequest {
  page: string;
  title: string;
  sliq: string;
  create: boolean;
  block_number?: number;
}

export async function saveQuery(req: SaveQueryRequest): Promise<{ page: string }> {
  const sbClient = await getSbClient();
  const blockNumber = req.block_number || 0;
  await saveQueryBlock(req.page, blockNumber, req.title, req.sliq, sbClient);
  return { page: req.page };
}

export async function testQuery(sliq: string): Promise<QueryExecuteResult> {
  const sbClient = await getSbClient();
  const tasks = await executeQuery(sliq, sbClient);
  return { title: 'Test Query', sliq, tasks: tasks as Task[] };
}

export async function checkHelpers(): Promise<{ exists: boolean }> {
  try {
    const sbClient = await getSbClient();
    await sbClient.queryTasks({ limit: '1' });
    return { exists: true };
  } catch {
    return { exists: false };
  }
}

export async function deployHelpers(): Promise<{ deployed: boolean; created?: boolean }> {
  try {
    const sbClient = await getSbClient();
    const result = await ensureSpaceConfig(sbClient);
    return { deployed: true, created: result.created };
  } catch {
    return { deployed: false };
  }
}

export async function getQueryPageNames(): Promise<string[]> {
  const sbClient = await getSbClient();
  const pages = await getQueryPages(sbClient);
  return pages.map((p) => p.page).sort();
}

export function getFavorites(): FavoriteQuery[] {
  return getSpaceConfig().favorites || [];
}

export function isQueryFavorite(page: string, heading: string): boolean {
  return isFavorite(getSpaceConfig(), page, heading);
}

export async function toggleQueryFavorite(
  page: string,
  heading: string,
  block: number,
): Promise<FavoriteQuery[]> {
  const sbClient = await getSbClient();
  const current = getSpaceConfig();
  const updated = toggleFavorite(current, page, heading, block);
  await writeSpaceConfig(sbClient, updated);
  const fresh = await readSpaceConfig(sbClient);
  setSpaceConfig(fresh);
  return fresh.favorites || [];
}
