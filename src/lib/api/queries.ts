import { api } from './client';
import type { Task } from '$lib/types/task';

export interface QueryPage {
  page: string;
  block_count: number;
  blocks: QueryBlockInfo[];
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

export async function getQueryPages(tag?: string): Promise<QueryPage[]> {
  const param = tag ? `?tag=${encodeURIComponent(tag)}` : '';
  return api.get<QueryPage[]>(`/queries${param}`);
}

export async function getQueryBlocks(page: string): Promise<QueryBlockInfo[]> {
  return api.get<QueryBlockInfo[]>(`/queries/${encodeURIComponent(page)}`);
}

export async function executeQuery(page: string, index?: number): Promise<QueryExecuteResult[]> {
  const body: { page: string; index?: number } = { page };
  if (index) body.index = index;
  return api.post<QueryExecuteResult[]>('/queries/execute', body);
}

export interface SaveQueryRequest {
  page: string;
  title: string;
  sliq: string;
  create: boolean;
  block_number?: number;
}

export async function saveQuery(req: SaveQueryRequest): Promise<{ page: string }> {
  return api.post<{ page: string }>('/queries/save', req);
}

export async function testQuery(sliq: string): Promise<QueryExecuteResult> {
  return api.post<QueryExecuteResult>('/queries/test', { sliq });
}
