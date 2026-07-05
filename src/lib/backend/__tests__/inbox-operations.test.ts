import { describe, it, expect } from 'vitest';
import { parseTasksFromPage } from '../task-parser';
import { toMarkdown } from '../task-serializer';
import type { Task } from '../task-types';

describe('inbox operations (integration)', () => {
  it('create → parse → serialize round-trip', () => {
    const task: Task = {
      page: 'Inbox',
      position: 1,
      text: 'Buy groceries',
      status: '',
      done: false,
      due: '[[Journal/2026-06-30]]',
      due_parsed: { date: '2026-06-30' },
      deferred: '',
      deferred_parsed: null,
      name: '',
      priority: 'high',
      tags: ['personal', 'errands'],
      parent: undefined,
      depends_on: undefined,
      blocked: false,
      recur: undefined,
      alerts: undefined,
      extra_attrs: undefined,
    };

    const line = toMarkdown(task);
    const parsed = parseTaskLine(line, 'Inbox', 1);

    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe('Buy groceries');
    expect(parsed!.done).toBe(false);
    expect(parsed!.priority).toBe('high');
    expect(parsed!.due).toBe('[[Journal/2026-06-30]]');
    expect(parsed!.tags).toContain('personal');
    expect(parsed!.tags).toContain('errands');
  });

  it('done task round-trip preserves status', () => {
    const task: Task = {
      page: 'Tasks',
      position: 3,
      text: 'Completed task',
      status: 'x',
      done: true,
      due: '',
      due_parsed: null,
      deferred: '',
      deferred_parsed: null,
      name: '',
      priority: '',
      tags: [],
      blocked: false,
    };

    const line = toMarkdown(task);
    const parsed = parseTaskLine(line, 'Tasks', 3);

    expect(parsed).not.toBeNull();
    expect(parsed!.done).toBe(true);
    expect(parsed!.status).toBe('x');
  });

  it('task with all fields round-trips correctly', () => {
    const task: Task = {
      page: 'Tasks',
      position: 5,
      text: 'Complete project',
      status: 'waiting',
      done: false,
      due: '[[Journal/2026-07-01]]',
      due_parsed: { date: '2026-07-01' },
      deferred: '[[Journal/2026-07-15]]',
      deferred_parsed: { date: '2026-07-15' },
      name: 'complete-project',
      priority: 'medium',
      tags: ['work', 'project-a'],
      parent: 'sprint-goals',
      depends_on: ['setup', 'planning'],
      blocked: true,
      recur: 'weekly:1',
      alerts: ['2026-07-01 09:00'],
      extra_attrs: { estimated: '8h', milestone: 'Q3' },
    };

    const line = toMarkdown(task);
    const parsed = parseTaskLine(line, 'Tasks', 5);

    expect(parsed).not.toBeNull();
    expect(parsed!.text).toBe('Complete project');
    expect(parsed!.status).toBe('waiting');
    expect(parsed!.priority).toBe('medium');
    expect(parsed!.name).toBe('complete-project');
    expect(parsed!.parent).toBe('sprint-goals');
    expect(parsed!.recur).toBe('weekly:1');
    expect(parsed!.tags).toContain('work');
    expect(parsed!.tags).toContain('project-a');
    expect(parsed!.depends_on).toEqual(['setup', 'planning']);

    const line2 = toMarkdown(parsed!);
    // Verify stable output: re-serializing produces same result
    expect(line2).toBe(line);
  });
});
