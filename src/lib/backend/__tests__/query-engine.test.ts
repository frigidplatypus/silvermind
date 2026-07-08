import { describe, it, expect } from 'vitest';
import {
  translateSLIQ,
  computeBlocked,
  applyHardExclusions,
  applyDefaultViewExclusions,
  applyGlobalTaskExclusions,
  excludeDone,
  filterByTags,
  filterExcludeTags,
  filterOverdue,
  filterBlocked,
  filterUnblocked,
  filterByStatuses,
  filterByOrphan,
  filterByRecur,
  sortTasks,
} from '../query-engine';
import type { Task } from '../task-types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    page: 'Tasks',
    position: 1,
    text: 'Test',
    status: '',
    done: false,
    due: '',
    due_parsed: null,
    deferred: '',
    deferred_parsed: null,
    name: '',
    priority: '',
    tags: [],
    blocked: false,
    ...overrides,
  };
}

describe('translateSLIQ', () => {
  it('excludes completed tasks by default', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nselect templates.taskItem(t)',
    );
    const done = makeTask({ done: true, status: 'x' });
    const active = makeTask({ done: false });

    const result = postFilter([done, active]);

    expect(result).toHaveLength(1);
    expect(result[0].done).toBe(false);
  });

  it('parses status filter', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere t.state == "waiting"\nselect templates.taskItem(t)',
    );
    const waiting = makeTask({ status: 'waiting' });
    const active = makeTask({ done: false });

    const result = postFilter([waiting, active]);

    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('waiting');
  });

  it('parses explicit done inclusion', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere t.done\nselect templates.taskItem(t)',
    );
    const done = makeTask({ done: true, status: 'x' });
    const active = makeTask({ done: false });

    const result = postFilter([done, active]);

    expect(result).toHaveLength(1);
    expect(result[0].done).toBe(true);
  });

  it('supports grouped status filters from SilverBullet queries', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere (t.done or t.state == "waiting") and t.state != "someday"\nselect templates.taskItem(t)',
    );
    const done = makeTask({ done: true, status: 'x' });
    const waiting = makeTask({ status: 'waiting' });
    const someday = makeTask({ status: 'someday' });
    const active = makeTask({ status: '' });

    const result = postFilter([done, waiting, someday, active]);

    expect(result).toHaveLength(2);
    expect(result.map((t) => t.status)).toEqual(['x', 'waiting']);
  });

  it('parses due before filter', () => {
    const { filter } = translateSLIQ(
      'from t = index.objects("task")\nwhere t.due < "2026-01-01"\nselect templates.taskItem(t)',
    );
    expect(filter.dueBefore).toBe('2026-01-01');
  });

  it('parses has tag filter', () => {
    const { filter } = translateSLIQ(
      'from t = index.objects("task")\nwhere table.includes(t.itags, "work")\nselect templates.taskItem(t)',
    );
    expect(filter.tags).toContain('work');
  });

  it('parses overdue filter', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere overdue\nselect templates.taskItem(t)',
    );
    const overdue = makeTask({ due: '2020-01-01', done: false });
    const notOverdue = makeTask({ due: '2099-01-01', done: false });
    const result = postFilter([overdue, notOverdue]);
    expect(result).toHaveLength(1);
    expect(result[0].due).toBe('2020-01-01');
  });

  it('parses blocked filter', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere blocked\nselect templates.taskItem(t)',
    );
    const blocked = makeTask({ blocked: true });
    const unblocked = makeTask({ blocked: false });
    const result = postFilter([blocked, unblocked]);
    expect(result).toHaveLength(1);
    expect(result[0].blocked).toBe(true);
  });

  it('parses sort order', () => {
    const { filter } = translateSLIQ(
      'from t = index.objects("task")\norder by t.due asc\nselect templates.taskItem(t)',
    );
    expect(filter.sortBy).toBe('due');
    expect(filter.sortOrder).toBe('asc');
  });

  it('parses limit', () => {
    const { filter } = translateSLIQ(
      'from t = index.objects("task")\nlimit 50\nselect templates.taskItem(t)',
    );
    expect(filter.limit).toBe(50);
  });

  it('parses orphan filter', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere orphan\nselect templates.taskItem(t)',
    );
    const orphan = makeTask({ text: 'orphan' });
    const child = makeTask({ text: 'child', parent: 'parent-task' });

    const result = postFilter([orphan, child]);

    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('orphan');
  });

  it('parses recur filter', () => {
    const { postFilter } = translateSLIQ(
      'from t = index.objects("task")\nwhere recur\nselect templates.taskItem(t)',
    );
    const recurring = makeTask({ text: 'recurring', recur: 'daily:1' });
    const oneOff = makeTask({ text: 'one-off' });

    const result = postFilter([recurring, oneOff]);

    expect(result).toHaveLength(1);
    expect(result[0].recur).toBe('daily:1');
  });
});

describe('computeBlocked', () => {
  it('marks task as blocked when dependency is not done', () => {
    const tasks: Task[] = [
      makeTask({ name: 'task-a', done: false, depends_on: ['task-b'] }),
      makeTask({ name: 'task-b', done: false }),
    ];
    computeBlocked(tasks);
    expect(tasks[0].blocked).toBe(true);
  });

  it('marks task as unblocked when all dependencies done', () => {
    const tasks: Task[] = [
      makeTask({ name: 'task-a', done: false, depends_on: ['task-b'] }),
      makeTask({ name: 'task-b', done: true }),
    ];
    computeBlocked(tasks);
    expect(tasks[0].blocked).toBe(false);
  });

  it('task without dependencies is not blocked', () => {
    const tasks: Task[] = [makeTask({ name: 'standalone', done: false })];
    computeBlocked(tasks);
    expect(tasks[0].blocked).toBe(false);
  });
});

describe('applyHardExclusions', () => {
  it('excludes done and waiting tasks', () => {
    const tasks = [
      makeTask({ status: 'x', done: true }),
      makeTask({ status: 'waiting' }),
      makeTask({ status: '' }),
    ];
    const result = applyHardExclusions(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('');
  });

  it('excludes Library pages and meta-tagged tasks', () => {
    const tasks = [
      makeTask({ page: 'Library/Templates', status: '' }),
      makeTask({ page: 'Tasks', tags: ['meta'] }),
      makeTask({ page: 'Tasks', tags: ['meta/template'] }),
      makeTask({ page: 'Tasks', tags: ['work'] }),
    ];
    const result = applyHardExclusions(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].tags).toEqual(['work']);
  });
});

describe('applyGlobalTaskExclusions', () => {
  it('excludes tasks from pages tagged meta or meta/*', async () => {
    const tasks = [
      makeTask({ page: 'Tasks' }),
      makeTask({ page: 'Templates' }),
      makeTask({ page: 'Library/Task Seed' }),
    ];

    const sbClient = {
      getBaseURL: () => 'https://example.com',
      readPage: async (page: string) => ({
        content:
          page === 'Templates'
            ? '---\ntags:\n  - meta/template\n---\n- [ ] hidden\n'
            : '---\ntags:\n  - work\n---\n- [ ] visible\n',
        lastModified: 0,
      }),
    } as any;

    const result = await applyGlobalTaskExclusions(tasks, sbClient);
    expect(result.map((task) => task.page)).toEqual(['Tasks']);
  });
});

describe('excludeDone', () => {
  it('filters out done and waiting tasks', () => {
    const tasks = [
      makeTask({ status: 'x', done: true }),
      makeTask({ status: 'waiting' }),
      makeTask({ status: '' }),
    ];
    const result = excludeDone(tasks);
    expect(result).toHaveLength(1);
  });
});

describe('filterByTags', () => {
  it('filters tasks by required tags', () => {
    const tasks = [
      makeTask({ tags: ['work'] }),
      makeTask({ tags: ['personal'] }),
      makeTask({ tags: ['work', 'code'] }),
    ];
    const result = filterByTags(tasks, ['work']);
    expect(result).toHaveLength(2);
  });
});

describe('filterExcludeTags', () => {
  it('filters excluded tags with or without a hash prefix', () => {
    const tasks = [
      makeTask({ text: 'shopping', tags: ['shopping-list'] }),
      makeTask({ text: 'planning', tags: ['coram-deo'] }),
      makeTask({ text: 'visible', tags: ['work'] }),
    ];
    const result = filterExcludeTags(tasks, ['#shopping-list', 'coram-deo']);
    expect(result.map((task) => task.text)).toEqual(['visible']);
  });
});

describe('applyDefaultViewExclusions', () => {
  it('filters tasks from pages tagged with excluded default-view tags', async () => {
    const tasks = [
      makeTask({ page: 'Shopping', tags: [] }),
      makeTask({ page: 'Tasks', tags: [] }),
    ];
    const sbClient = {
      getBaseURL: () => 'https://example.test',
      readPage: async (page: string) => ({
        lastModified: 0,
        content:
          page === 'Shopping'
            ? '---\ntags:\n  - shopping-list\n---\n- [ ] milk\n'
            : '---\ntags:\n  - work\n---\n- [ ] visible\n',
      }),
    } as any;

    const result = await applyDefaultViewExclusions(tasks, sbClient, ['#shopping-list']);
    expect(result.map((task) => task.page)).toEqual(['Tasks']);
  });
});

describe('filterByOrphan', () => {
  it('filters tasks without parent', () => {
    const tasks = [
      makeTask({ text: 'orphan' }),
      makeTask({ text: 'child', parent: 'parent-task' }),
    ];
    const result = filterByOrphan(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('orphan');
  });
});

describe('filterByRecur', () => {
  it('filters tasks with recurrence', () => {
    const tasks = [
      makeTask({ text: 'recurring', recur: 'daily:1' }),
      makeTask({ text: 'one-off' }),
    ];
    const result = filterByRecur(tasks);
    expect(result).toHaveLength(1);
  });
});

describe('sortTasks', () => {
  it('sorts by priority ascending', () => {
    const tasks = [
      makeTask({ priority: 'low', text: 'c' }),
      makeTask({ priority: 'high', text: 'a' }),
      makeTask({ priority: 'medium', text: 'b' }),
    ];
    sortTasks(tasks, 'priority', 'asc');
    expect(tasks[0].priority).toBe('high');
    expect(tasks[1].priority).toBe('low');
    expect(tasks[2].priority).toBe('medium');
  });

  it('sorts descending', () => {
    const tasks = [makeTask({ text: 'a', position: 1 }), makeTask({ text: 'b', position: 2 })];
    sortTasks(tasks, 'position', 'desc');
    expect(tasks[0].position).toBe(2);
    expect(tasks[1].position).toBe(1);
  });
});
