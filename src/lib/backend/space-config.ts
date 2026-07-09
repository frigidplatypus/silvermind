import type { SbClient } from './sb-client';
import type { SpaceConfigRemote, FavoriteQuery } from './task-types';
import { extractQueryBlocks } from './query-operations';
import { logInfo, logWarn, logError } from '$lib/helpers/logger';

const CONFIG_PAGE = 'Library/Silvermind/config';
const JOURNAL_DEFAULT_PREFIX = 'Journal/';

export function getDefaultConfig(): SpaceConfigRemote {
  return {
    inbox_mode: 'page',
    inbox_page: 'Inbox',
    exclude_tags: [],
    default_sort_by: 'due',
    default_sort_order: 'asc',
    favorites: [],
  };
}

export function formatToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function readJournalPrefix(sbClient: SbClient): Promise<string> {
  try {
    const { content } = await sbClient.readPage('SETTINGS');
    if (!content) return JOURNAL_DEFAULT_PREFIX;

    const lines = content.split('\n');
    let inJournal = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'journal:') {
        inJournal = true;
        continue;
      }
      if (inJournal) {
        if (trimmed.startsWith('prefix:')) {
          const val = trimmed
            .slice(7)
            .trim()
            .replace(/^["']|["']$/g, '');
          if (val) return val;
          return JOURNAL_DEFAULT_PREFIX;
        }
        if (
          trimmed &&
          !trimmed.startsWith(' ') &&
          !trimmed.startsWith('\t') &&
          !trimmed.startsWith('-') &&
          !trimmed.startsWith('#')
        ) {
          inJournal = false;
        }
      }
    }
    return JOURNAL_DEFAULT_PREFIX;
  } catch {
    return JOURNAL_DEFAULT_PREFIX;
  }
}

export function resolveInboxPage(config: SpaceConfigRemote, journalPrefix: string): string {
  if (config.inbox_mode === 'journal') {
    return `${journalPrefix}${formatToday()}`;
  }
  return config.inbox_page || 'Inbox';
}

export function parseConfigYaml(content: string): SpaceConfigRemote {
  const match = content.match(/```yaml\n([\s\S]*?)```/);
  if (!match) return {};

  const yamlStr = match[1];
  const config: SpaceConfigRemote = {};

  for (const line of yamlStr.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const value = trimmed.slice(colonIdx + 1).trim();

    switch (key) {
      case 'inbox_mode':
        if (value && value !== '~' && value !== 'null') {
          config.inbox_mode = value.replace(/^["']|["']$/g, '');
        }
        break;
      case 'inbox_page':
        if (value && value !== '~' && value !== 'null') {
          config.inbox_page = value.replace(/^["']|["']$/g, '');
        }
        break;
      case 'favorites':
        config.favorites = parseFavorites(trimmed, yamlStr, line);
        break;
      case 'exclude_tags': {
        const tags = parseYamlArray(trimmed, yamlStr, line);
        if (tags) config.exclude_tags = tags;
        break;
      }
      case 'default_sort_by':
        if (value && value !== '~' && value !== 'null') {
          config.default_sort_by = value.replace(/^["']|["']$/g, '');
        }
        break;
      case 'default_sort_order':
        if (value && value !== '~' && value !== 'null') {
          config.default_sort_order = value.replace(/^["']|["']$/g, '');
        }
        break;
    }
  }

  return config;
}

function parseYamlArray(
  firstLine: string,
  fullBlock: string,
  firstLineStr: string,
): string[] | null {
  const inlineMatch = firstLine.match(/^exclude_tags:\s*\[(.+)\]\s*$/);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(',')
      .map((t) =>
        t
          .trim()
          .replace(/^["']|["']$/g, '')
          .replace(/^#/, ''),
      )
      .filter(Boolean);
  }

  const firstIdx = fullBlock.indexOf(firstLineStr);
  if (firstIdx === -1) return null;

  const afterFirst = fullBlock.slice(firstIdx + firstLineStr.length);
  const items: string[] = [];
  for (const line of afterFirst.split('\n')) {
    const m = line.match(/^\s*-\s+(.+)/);
    if (!m) break;
    items.push(
      m[1]
        .trim()
        .replace(/^["']|["']$/g, '')
        .replace(/^#/, ''),
    );
  }
  return items.length > 0 ? items : null;
}

function parseFavorites(
  _firstLine: string,
  fullBlock: string,
  firstLineStr: string,
): FavoriteQuery[] {
  const firstIdx = fullBlock.indexOf(firstLineStr);
  if (firstIdx === -1) return [];

  const afterFirst = fullBlock.slice(firstIdx + firstLineStr.length);
  const favorites: FavoriteQuery[] = [];
  let currentPage = '';
  let currentHeading = '';
  let currentBlock = 0;

  for (const line of afterFirst.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- page:') && currentPage && currentHeading) {
      favorites.push({ page: currentPage, heading: currentHeading, block: currentBlock });
      currentPage = '';
      currentHeading = '';
      currentBlock = 0;
    }
    const pageMatch = trimmed.match(/^-\s+page:\s*(.+)/);
    if (pageMatch) {
      currentPage = pageMatch[1].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    const headingMatch = trimmed.match(/^-\s+heading:\s*(.+)/);
    if (headingMatch) {
      currentHeading = headingMatch[1].trim().replace(/^["']|["']$/g, '');
      continue;
    }
    const blockMatch = trimmed.match(/^-\s+block:\s*(\d+)/);
    if (blockMatch) {
      currentBlock = parseInt(blockMatch[1], 10);
      continue;
    }
  }
  if (currentPage && currentHeading) {
    favorites.push({ page: currentPage, heading: currentHeading, block: currentBlock });
  }

  return favorites;
}

export function formatConfigYaml(config: SpaceConfigRemote): string {
  const lines: string[] = [];

  lines.push(`inbox_mode: ${config.inbox_mode || 'page'}`);

  if (config.inbox_mode !== 'journal') {
    lines.push(`inbox_page: ${config.inbox_page || 'Inbox'}`);
  } else {
    lines.push(`# inbox_page is ignored when inbox_mode is "journal"`);
  }

  const tags = config.exclude_tags || [];
  if (tags.length > 0) {
    lines.push('exclude_tags:');
    for (const tag of tags) {
      lines.push(`  - ${tag}`);
    }
  } else {
    lines.push('exclude_tags: []');
  }

  if (config.default_sort_by) {
    lines.push(`default_sort_by: ${config.default_sort_by}`);
  }
  if (config.default_sort_order) {
    lines.push(`default_sort_order: ${config.default_sort_order}`);
  }

  const favs = config.favorites || [];
  if (favs.length > 0) {
    lines.push('favorites:');
    for (const f of favs) {
      lines.push(`  - page: ${f.page}`);
      lines.push(`    heading: ${f.heading}`);
      lines.push(`    block: ${f.block}`);
    }
  }

  return lines.join('\n');
}

export interface ResolvedFavorite {
  page: string;
  block: number;
  heading: string;
}

export function isFavorite(config: SpaceConfigRemote, page: string, heading: string): boolean {
  return (config.favorites || []).some((f) => f.page === page && f.heading === heading);
}

export function toggleFavorite(
  config: SpaceConfigRemote,
  page: string,
  heading: string,
  block: number,
): SpaceConfigRemote {
  const favs = [...(config.favorites || [])];
  const idx = favs.findIndex((f) => f.page === page && f.heading === heading);
  if (idx >= 0) {
    favs.splice(idx, 1);
  } else {
    favs.push({ page, heading, block });
  }
  return { ...config, favorites: favs };
}

export async function readSpaceConfig(sbClient: SbClient): Promise<SpaceConfigRemote> {
  try {
    const { content } = await sbClient.readPage(CONFIG_PAGE);
    if (!content) {
      logInfo(`[space-config] Config page not found at ${CONFIG_PAGE}`);
      return {};
    }
    const config = parseConfigYaml(content);
    logInfo(`[space-config] Read config from ${CONFIG_PAGE}: ${JSON.stringify(config)}`);
    return config;
  } catch (e: any) {
    logWarn(`[space-config] Failed to read config page: ${e.message || e}`);
    return {};
  }
}

export async function writeSpaceConfig(
  sbClient: SbClient,
  config: SpaceConfigRemote,
): Promise<void> {
  const { content, lastModified } = await sbClient.readPage(CONFIG_PAGE);

  const yamlBlock = formatConfigYaml(config);
  const newBlock = '```yaml\n' + yamlBlock + '\n```';

  let updated: string;
  const match = content.match(/```yaml\n[\s\S]*?```/);
  if (match) {
    updated =
      content.slice(0, match.index) + newBlock + content.slice(match.index! + match[0].length);
  } else {
    const frontMatterMatch = content.match(/^---\n[\s\S]*?\n---/);
    if (frontMatterMatch) {
      const afterFM = content.slice(frontMatterMatch[0].length);
      updated = content.slice(0, frontMatterMatch[0].length) + '\n' + newBlock + afterFM;
    } else {
      updated = content ? content.trimEnd() + '\n\n' + newBlock + '\n' : newBlock + '\n';
    }
  }

  const pagePath = CONFIG_PAGE;
  try {
    await sbClient.writePage(pagePath, updated, lastModified || undefined);
  } catch (e: any) {
    if (e?.status === 412) {
      logWarn('[space-config] Config page modified concurrently, retrying once...');
      const fresh = await sbClient.readPage(CONFIG_PAGE);
      const freshBlock = match
        ? fresh.content.slice(0, match.index) +
          newBlock +
          fresh.content.slice(match.index! + match[0].length)
        : updated;
      await sbClient.writePage(pagePath, freshBlock, fresh.lastModified || undefined);
    } else {
      throw e;
    }
  }

  logInfo(`[space-config] Wrote config to ${CONFIG_PAGE}`);
}

export async function ensureSpaceConfig(
  sbClient: SbClient,
): Promise<{ config: SpaceConfigRemote; created: boolean }> {
  try {
    const { content } = await sbClient.readPage(CONFIG_PAGE);
    if (content) {
      return { config: parseConfigYaml(content), created: false };
    }
  } catch (e: any) {
    logError(`[space-config] Failed to read config page: ${e.message || e}`);
  }

  const defaults = getDefaultConfig();
  const yamlBlock = formatConfigYaml(defaults);
  const pageContent = `---
tags:
  - meta/silvermind/config
---

# Silvermind Config

Configure how Silvermind interacts with this space.

## Inbox

Where new tasks are created when you use Quick Add.

| Setting      | Description                                                                 |
| ------------ | --------------------------------------------------------------------------- |
| \`inbox_mode\` | \`page\` — use a named page (default). \`journal\` — use your SB journal.   |
| \`inbox_page\` | Page name when \`inbox_mode\` is \`page\` (e.g. \`Inbox\`, \`Tasks\`). Ignored in journal mode. |

### Using your SilverBullet journal

Set \`inbox_mode: journal\` and tasks will be added to today's journal entry
(\`Journal/YYYY-MM-DD\`). Silvermind reads your journal prefix from
[SETTINGS](${sbClient.getBaseURL()}/SETTINGS) (the \`journal.prefix\` key).
If no journal is configured it defaults to \`Journal/\`.

## Excluded Tags

Tags listed here are hidden from your Task List, Today, and All Tasks views.
Custom queries can still reference them.

## Sorting

Controls the default sort order for the task list. \`default_sort_by\` accepts
\`due\`, \`priority\`, \`page\`, or \`name\`. \`default_sort_order\` is \`asc\` or \`desc\`.

\`\`\`yaml
${yamlBlock}
\`\`\`
`;

  try {
    await sbClient.writePage(CONFIG_PAGE, pageContent);
    logInfo(`[space-config] Created default config page at ${CONFIG_PAGE}`);
    return { config: defaults, created: true };
  } catch (e: any) {
    logError(`[space-config] Failed to create config page: ${e.message || e}`);
    return { config: defaults, created: false };
  }
}
