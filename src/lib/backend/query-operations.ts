import type { SbClient } from './sb-client';
import type { Task, QueryBlock, QueryBlockPage } from './task-types';
import { translateSLIQ, computeBlocked, applyHardExclusions, sortTasks, normalizePositions } from './query-engine';
import { parseTasksFromPage } from './task-parser';

export function extractQueryBlocks(content: string): QueryBlock[] {
  const blocks: QueryBlock[] = [];
  const fenceRe = /```sliq\s*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let blockNum = 0;

  while ((match = fenceRe.exec(content)) !== null) {
    blockNum++;
    const sliq = match[1].trim();
    const lines = sliq.split('\n');
    let title = '';
    const queryLines: string[] = [];

    for (const line of lines) {
      if (line.startsWith('#') && !title) {
        title = line.replace(/^#+\s*/, '').trim();
      } else {
        queryLines.push(line);
      }
    }

    blocks.push({
      page: '',
      number: blockNum,
      title: title || `Query ${blockNum}`,
      sliq: queryLines.join('\n').trim(),
    });
  }

  return blocks;
}

export function replaceQueryBlock(content: string, blockNumber: number, newTitle: string, newSLIQ: string): string {
  let idx = 0;
  return content.replace(/```sliq\s*\n[\s\S]*?```/g, (match) => {
    idx++;
    if (idx === blockNumber) {
      const titleLine = newTitle ? `# ${newTitle}\n` : '';
      return '```sliq\n' + titleLine + newSLIQ + '\n```';
    }
    return match;
  });
}

export async function getQueryPages(sbClient: SbClient): Promise<QueryBlockPage[]> {
  const pages = await sbClient.findPagesByTag('query');
  const result: QueryBlockPage[] = [];

  for (const page of pages) {
    try {
      const { content } = await sbClient.readPage(page);
      const blocks = extractQueryBlocks(content).map(b => ({ ...b, page }));
      if (blocks.length > 0) {
        result.push({ page, blocks });
      }
    } catch {
      // skip inaccessible pages
    }
  }

  return result;
}

export async function executeQueryBlock(
  page: string,
  blockNumber: number,
  sbClient: SbClient,
): Promise<Task[]> {
  const { content } = await sbClient.readPage(page);
  const blocks = extractQueryBlocks(content);
  const block = blocks.find(b => b.number === blockNumber);
  if (!block) throw new Error(`Query block ${blockNumber} not found on page ${page}`);

  return executeQuery(block.sliq, sbClient);
}

export async function executeQuery(sliq: string, sbClient: SbClient): Promise<Task[]> {
  const { filter, postFilter } = translateSLIQ(sliq);
  const params: Record<string, string> = {};
  if (filter.page) params['page'] = filter.page;
  if (filter.limit) params['limit'] = String(filter.limit);
  if (filter.status && filter.status.length > 0) {
    params['status'] = filter.status.join(',');
  }

  let tasks: Task[];
  try {
    const runtimeTasks = await sbClient.queryTasks(params);
    tasks = runtimeTasks.map((rt: any) => ({
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
  } catch {
    tasks = [];
  }

  computeBlocked(tasks);
  tasks = applyHardExclusions(tasks);
  tasks = postFilter(tasks);
  normalizePositions(tasks);
  if (filter.sortBy) {
    sortTasks(tasks, filter.sortBy, filter.sortOrder || 'asc');
  }

  return tasks;
}

export async function saveQueryBlock(
  page: string,
  blockNumber: number,
  title: string,
  sliq: string,
  sbClient: SbClient,
): Promise<void> {
  await sbClient.readModifyWrite(page, async (content) => {
    const blocks = extractQueryBlocks(content);
    if (blockNumber > 0 && blocks.some(b => b.number === blockNumber)) {
      return replaceQueryBlock(content, blockNumber, title, sliq);
    }
    const newBlock = '```sliq\n' + (title ? '# ' + title + '\n' : '') + sliq + '\n```\n';
    return content.trimEnd() + '\n\n' + newBlock;
  });
}
