import { describe, it, expect } from 'vitest';
import {
  translateSLIQ,
  computeBlocked,
  applyHardExclusions,
  excludeDone,
  filterByTags,
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
  it('parses status filter', () => {
    const { filter } = translateSLIQ('status == "x"');
    expect(filter.status).toEqual(['x']);
  });

  it('parses due before filter', () => {
    const { filter } = translateSLIQ('due < "2026-01-01"');
    expect(filter.dueBefore).toBe('2026-01-01');
  });

  it('parses has tag filter', () => {
    const { filter } = translateSLIQ('has #work');
    expect(filter.tags).toContain('work');
  });

  it('parses overdue filter', () => {
    const { postFilter } = translateSLIQ('overdue');
    const overdue = makeTask({ due: '2020-01-01', done: false });
    const notOverdue = makeTask({ due: '2099-01-01', done: false });
    const result = postFilter([overdue, notOverdue]);
    expect(result).toHaveLength(1);
    expect(result[0].due).toBe('2020-01-01');
  });

  it('parses blocked filter', () => {
    const { postFilter } = translateSLIQ('blocked');
    const blocked = makeTask({ blocked: true });
    const unblocked = makeTask({ blocked: false });
    const result = postFilter([blocked, unblocked]);
    expect(result).toHaveLength(1);
    expect(result[0].blocked).toBe(true);
  });

  it('parses sort order', () => {
    const { filter } = translateSLIQ('sort due asc');
    expect(filter.sortBy).toBe('due');
    expect(filter.sortOrder).toBe('asc');
  });

  it('parses limit', () => {
    const { filter } = translateSLIQ('limit 50');
    expect(filter.limit).toBe(50);
  });

  it('parses orphan filter', () => {
    const { filter } = translateSLIQ('orphan');
    expect(filter.orphan).toBe(true);
  });

  it('parses recur filter', () => {
    const { filter } = translateSLIQ('recur');
    expect(filter.recur).toBe(true);
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
    const tasks = [
      makeTask({ text: 'a', position: 1 }),
      makeTask({ text: 'b', position: 2 }),
    ];
    sortTasks(tasks, 'position', 'desc');
    expect(tasks[0].position).toBe(2);
    expect(tasks[1].position).toBe(1);
  });
});
