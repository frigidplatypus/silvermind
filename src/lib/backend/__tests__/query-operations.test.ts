import { describe, it, expect } from 'vitest';
import type { SbClient } from '../sb-client';
import type { SilverBulletPage } from '../task-types';
import { extractQueryBlocks, saveQueryBlock } from '../query-operations';

function mockSbClient(initialPage: string = ''): {
  client: SbClient;
  getPage: () => string;
} {
  let pageContent = initialPage;
  let lastModified = 1;

  const client: SbClient = {
    readPage: async (_path: string): Promise<SilverBulletPage> => ({
      content: pageContent,
      lastModified,
    }),
    writePage: async (_path: string, content: string): Promise<void> => {
      pageContent = content;
      lastModified += 1;
    },
    readModifyWrite: async (
      path: string,
      fn: (content: string) => Promise<string>,
      _maxRetries = 3,
    ): Promise<void> => {
      const page = await client.readPage(path);
      const modified = await fn(page.content);
      await client.writePage(path, modified, page.lastModified);
    },
    queryTasks: async () => [],
    getTask: async () => null,
    findPagesByTag: async () => [],
    getBaseURL: () => 'https://test.example.com',
  };

  return {
    client,
    getPage: () => pageContent,
  };
}

describe('saveQueryBlock', () => {
  it('adds the Silvermind query tag to new pages', async () => {
    const mock = mockSbClient('');

    await saveQueryBlock('Queries/Home', 0, 'My Query', 'from t = index.objects("task") select templates.taskItem(t)', mock.client);

    const page = mock.getPage();
    expect(page).toContain('tags:');
    expect(page).toContain('silvermind/queries');
    expect(page).toContain('## My Query');
    expect(extractQueryBlocks(page)).toHaveLength(1);
  });

  it('merges the query tag into existing frontmatter', async () => {
    const mock = mockSbClient(`---\nname: Example\ntags:\n  - existing\n---\n## Old\n\${query[[\nfrom t = index.objects("task") select templates.taskItem(t)\n]]}\n`);

    await saveQueryBlock('Queries/Home', 1, 'Updated', 'from t = index.objects("task") where t.done select templates.taskItem(t)', mock.client);

    const page = mock.getPage();
    expect(page).toContain('existing');
    expect(page).toContain('silvermind/queries');
    expect(page).toContain('## Updated');
    expect(extractQueryBlocks(page)).toHaveLength(1);
  });
});
