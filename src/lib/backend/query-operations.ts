import type { SbClient } from './sb-client';
import type { Task, QueryBlock, QueryBlockPage, TaskFilter } from './task-types';
import {
  translateSLIQ,
  sortTasks,
  normalizePositions,
  filterByTags,
  filterExcludeTags,
  applyGlobalTaskExclusions,
} from './query-engine';
import { parseTasksFromPage, mapRuntimeTask } from './task-parser';
import { logInfo, logWarn, logError } from '$lib/helpers/logger';
import * as yaml from 'js-yaml';

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

export function extractQueryBlocks(content: string): QueryBlock[] {
  const queryBlockRe = /\$\{query\[\[([\s\S]*?)\]\]\}/g;
  const fencedSLIQRe = /```sliq\n?([\s\S]*?)\n?```/g;
  const lines = content.split('\n');

  interface Match {
    raw: string;
    sliq: string;
    offset: number;
  }
  const matches: Match[] = [];

  let m: RegExpExecArray | null;
  queryBlockRe.lastIndex = 0;
  while ((m = queryBlockRe.exec(content)) !== null) {
    matches.push({ raw: m[0], sliq: m[1].trim(), offset: m.index });
  }
  fencedSLIQRe.lastIndex = 0;
  while ((m = fencedSLIQRe.exec(content)) !== null) {
    matches.push({ raw: m[0], sliq: m[1].trim(), offset: m.index });
  }

  matches.sort((a, b) => a.offset - b.offset);

  function findMatchLine(raw: string): number {
    const idx = content.indexOf(raw);
    if (idx < 0) return 0;
    let count = 0;
    for (let i = 0; i < lines.length; i++) {
      count += lines[i].length + 1;
      if (count > idx) return i;
    }
    return 0;
  }

  function findNearestHeading(matchLine: number): string {
    for (let i = matchLine - 1; i >= 0; i--) {
      const l = lines[i].trim();
      if (l.startsWith('#')) {
        return l.replace(/^#+\s*/, '').trim();
      }
    }
    return '';
  }

  const blocks: QueryBlock[] = [];
  let blockNum = 0;
  for (const m of matches) {
    if (!m.sliq) continue;
    blockNum++;
    const title = findNearestHeading(findMatchLine(m.raw)) || `Query ${blockNum}`;
    blocks.push({ page: '', number: blockNum, title, sliq: m.sliq, raw: m.raw, heading: title });
  }

  return blocks;
}

export function replaceQueryBlock(
  content: string,
  blockNumber: number,
  newTitle: string,
  newSLIQ: string,
): string {
  const blocks = extractQueryBlocks(content);
  if (blockNumber < 1 || blockNumber > blocks.length) return content;

  const target = blocks[blockNumber - 1];
  const newBlock = newTitle
    ? `\n## ${newTitle}\n\${query[[\n${newSLIQ}\n]]}\n`
    : `\${query[[\n${newSLIQ}\n]]}\n`;

  if (target.raw) {
    return content.replace(target.raw, newBlock);
  }

  return content + '\n' + newBlock;
}

export async function getQueryPages(sbClient: SbClient): Promise<QueryBlockPage[]> {
  logInfo('[queries] getQueryPages — calling findPagesByTag(silvermind/queries)');
  let pages: string[];
  try {
    pages = await withTimeout(
      sbClient.findPagesByTag('silvermind/queries'),
      6000,
      'Runtime query page lookup',
    );
  } catch (e) {
    logError('[queries] findPagesByTag failed:', e);
    return [];
  }
  logInfo(`[queries] getQueryPages — found ${pages.length} pages: ${JSON.stringify(pages)}`);
  const result: QueryBlockPage[] = [];

  for (const page of pages) {
    try {
      const { content } = await sbClient.readPage(page);
      logInfo(`[queries] getQueryPages — read page "${page}": ${content.length} bytes`);
      const blocks = extractQueryBlocks(content).map((b) => ({ ...b, page }));
      logInfo(`[queries] getQueryPages — page "${page}" has ${blocks.length} query blocks`);
      if (blocks.length > 0) {
        result.push({ page, blocks });
      } else {
        logWarn(`[queries] getQueryPages — page "${page}" has NO query blocks`);
      }
    } catch (e) {
      logWarn(`[queries] getQueryPages — failed to read page "${page}":`, e);
    }
  }

  logInfo(`[queries] getQueryPages — returning ${result.length} pages with blocks`);
  return result;
}

export async function executeQueryBlock(
  page: string,
  blockNumber: number,
  sbClient: SbClient,
): Promise<Task[]> {
  const { content } = await sbClient.readPage(page);
  const blocks = extractQueryBlocks(content);
  const block = blocks.find((b) => b.number === blockNumber);
  if (!block) throw new Error(`Query block ${blockNumber} not found on page ${page}`);

  return executeQuery(block.sliq, sbClient);
}

function filterToQueryParams(filter: TaskFilter): Record<string, string> {
  const params: Record<string, string> = {};

  if (filter.status && filter.status.length === 1) {
    params['where[state]'] = filter.status[0];
  }

  if (filter.page) {
    params['where[page]'] = filter.page;
  }

  if (filter.name) {
    params['where[name]'] = filter.name;
  }

  if (filter.priority) {
    params['where[priority]'] = filter.priority;
  }

  if (filter.textSearch) {
    params['where[name][contains]'] = filter.textSearch;
  }

  if (filter.dueAfter) {
    params['where[due][gte]'] = filter.dueAfter;
  }
  if (filter.dueBefore) {
    params['where[due][lte]'] = filter.dueBefore;
  }
  if (filter.deferredAfter) {
    params['where[deferred][gte]'] = filter.deferredAfter;
  }
  if (filter.deferredBefore) {
    params['where[deferred][lte]'] = filter.deferredBefore;
  }

  if (filter.sortBy) {
    let order = filter.sortBy;
    if (filter.sortOrder === 'desc') order += ':desc';
    params['order'] = order;
  }

  if (filter.limit && filter.limit > 0) {
    params['limit'] = String(filter.limit);
  } else {
    params['limit'] = '100';
  }

  if (filter.tags && filter.tags.length > 0) {
    const limit = parseInt(params['limit'] || '0', 10);
    if (limit < 500) params['limit'] = '500';
  }

  return params;
}

export async function executeQuery(sliq: string, sbClient: SbClient): Promise<Task[]> {
  const { filter, postFilter } = translateSLIQ(sliq);
  const params = filterToQueryParams(filter);

  let tasks: Task[];
  try {
    const runtimeTasks = await withTimeout(
      sbClient.queryTasks(params),
      6000,
      'Runtime query execution',
    );
    tasks = runtimeTasks.map(mapRuntimeTask);
  } catch (e) {
    logError('[queries] executeQuery runtime task query failed:', e);
    tasks = [];
  }

  tasks = await applyGlobalTaskExclusions(tasks, sbClient);

  // Apply server-side tag filter if tags were specified
  if (filter.tags && filter.tags.length > 0) {
    tasks = filterByTags(tasks, filter.tags);
  }
  if (filter.excludeTags && filter.excludeTags.length > 0) {
    tasks = filterExcludeTags(tasks, filter.excludeTags);
  }

  // FUTURE: task dependencies & blocking
  // computeBlocked(tasks);
  tasks = postFilter(tasks);
  normalizePositions(tasks);
  if (filter.sortBy) {
    sortTasks(tasks, filter.sortBy, filter.sortOrder || 'asc');
  }

  return tasks;
}

const QUERY_PAGE_TAG = 'silvermind/queries';

function normalizePageTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim().replace(/^#/, '')).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean);
  }
  return [];
}

function ensureQueryPageTagged(content: string): string {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fmMatch) {
    const body = content.trimStart();
    return `---\ntags:\n  - ${QUERY_PAGE_TAG}\n---\n${body}`;
  }

  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed = yaml.load(fmMatch[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      frontmatter = { ...(parsed as Record<string, unknown>) };
    }
  } catch {
    frontmatter = {};
  }

  const tags = new Set([...normalizePageTags(frontmatter.tags), QUERY_PAGE_TAG]);
  frontmatter.tags = [...tags];

  const renderedFrontmatter = yaml.dump(frontmatter, { sortKeys: false, lineWidth: -1 }).trimEnd();
  const body = content.slice(fmMatch[0].length);
  return `---\n${renderedFrontmatter}\n---\n${body}`;
}

export async function saveQueryBlock(
  page: string,
  blockNumber: number,
  title: string,
  sliq: string,
  sbClient: SbClient,
): Promise<void> {
  await sbClient.readModifyWrite(page, async (content) => {
    const taggedContent = ensureQueryPageTagged(content);
    const blocks = extractQueryBlocks(taggedContent);
    if (blockNumber > 0 && blocks.some((b) => b.number === blockNumber)) {
      return replaceQueryBlock(taggedContent, blockNumber, title, sliq);
    }
    const newBlock = title
      ? `\n## ${title}\n\${query[[\n${sliq}\n]]}\n`
      : `\${query[[\n${sliq}\n]]}\n`;
    return taggedContent.trimEnd() + '\n' + newBlock;
  });
}
