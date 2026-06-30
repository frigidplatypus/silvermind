import { getSbClient } from '$lib/backend/backend-context';
import { getQueryPages, executeQueryBlock, saveQueryBlock } from '$lib/backend/query-operations';
import { executeQuery } from '$lib/backend/query-operations';
import { extractQueryBlocks } from '$lib/backend/query-operations';
import type { Task } from '$lib/types/task';

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
  const sbClient = getSbClient();
  const pages = await getQueryPages(sbClient);
  return pages.map(p => ({
    page: p.page,
    block_count: p.blocks.length,
    blocks: p.blocks.map(b => ({ title: b.title, number: b.number, sliq: b.sliq })),
  }));
}
export { getQueryPagesFn as getQueryPages };

export async function getQueryBlocks(page: string): Promise<QueryBlockInfo[]> {
  const sbClient = getSbClient();
  const { content } = await sbClient.readPage(page);
  const blocks = extractQueryBlocks(content);
  return blocks.map(b => ({ title: b.title, number: b.number, sliq: b.sliq }));
}

export async function executeQueryFn(page: string, index?: number): Promise<QueryExecuteResult[]> {
  const sbClient = getSbClient();
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
  const sbClient = getSbClient();
  const blockNumber = req.block_number || 0;
  await saveQueryBlock(req.page, blockNumber, req.title, req.sliq, sbClient);
  return { page: req.page };
}

export async function testQuery(sliq: string): Promise<QueryExecuteResult> {
  const sbClient = getSbClient();
  const tasks = await executeQuery(sliq, sbClient);
  return { title: 'Test Query', sliq, tasks: tasks as Task[] };
}

export async function checkHelpers(): Promise<{ exists: boolean }> {
  return { exists: true };
}

export async function deployHelpers(): Promise<{ deployed: boolean }> {
  return { deployed: true };
}
