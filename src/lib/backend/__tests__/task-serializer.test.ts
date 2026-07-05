import { describe, it, expect } from 'vitest';
import { toMarkdown, formatWikiLinks, formatJournalLink, parseJournalLink } from '../task-serializer';
import type { Task } from '../task-types';

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    page: 'Inbox',
    position: 1,
    text: 'Test task',
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

describe('toMarkdown', () => {
  it('serializes a basic active task', () => {
    const task = baseTask();
    expect(toMarkdown(task)).toBe('- [ ] Test task');
  });

  it('serializes a done task', () => {
    const task = baseTask({ status: 'x', done: true });
    expect(toMarkdown(task)).toBe('- [x] Test task');
  });

  it('serializes a task with due date', () => {
    const task = baseTask({ due: '[[Journal/2026-06-30]]' });
    const result = toMarkdown(task);
    expect(result).toContain('[due: "[[Journal/2026-06-30]]"]');
    expect(result).toContain('- [ ] Test task');
  });

  it('serializes a task with priority', () => {
    const task = baseTask({ priority: 'high' });
    const result = toMarkdown(task);
    expect(result).toContain('[priority: "high"]');
  });

  it('serializes a task with name', () => {
    const task = baseTask({ name: 'my-task' });
    const result = toMarkdown(task);
    expect(result).toContain('[name: "my-task"]');
  });

  it('serializes a task with recurrence', () => {
    const task = baseTask({ recur: 'daily:1' });
    const result = toMarkdown(task);
    expect(result).toContain('[recur: "daily:1"]');
  });

  it('serializes a task with parent', () => {
    const task = baseTask({ parent: 'parent-task' });
    const result = toMarkdown(task);
    expect(result).toContain('[parent: "parent-task"]');
  });

  it('serializes a task with deferred', () => {
    const task = baseTask({ deferred: '[[Journal/2026-07-01]]' });
    const result = toMarkdown(task);
    expect(result).toContain('[deferred: "[[Journal/2026-07-01]]"]');
  });

  it('serializes a task with depends_on', () => {
    const task = baseTask({ depends_on: ['step1', 'step2'] });
    const result = toMarkdown(task);
    expect(result).toContain('[dependsOn: "step1, step2"]');
  });

  it('serializes a task with alerts', () => {
    const task = baseTask({ alerts: ['2026-07-01 09:00', '2026-07-01 08:30'] });
    const result = toMarkdown(task);
    expect(result).toContain('[alerts: "2026-07-01 09:00, 2026-07-01 08:30"]');
  });

  it('serializes extra attributes', () => {
    const task = baseTask({ extra_attrs: { effort: '3h', workspace: 'office' } });
    const result = toMarkdown(task);
    expect(result).toContain('[effort: "3h"]');
    expect(result).toContain('[workspace: "office"]');
  });

  it('produces stable sorted output', () => {
    const task = baseTask({
      priority: 'high',
      due: '2026-01-01',
      name: 'test',
    });
    const result = toMarkdown(task);
    expect(result).toMatch(/^\- \[ \] Test task \[due: "[^\]]*"\] \[name: "[^\]]*"\] \[priority: "[^\]]*"\]$/);
  });

  it('round-trips a complex task', () => {
    const original: Task = {
      page: 'Tasks',
      position: 5,
      text: 'Review PR',
      status: '',
      done: false,
      due: '[[Journal/2026-06-30]]',
      due_parsed: { date: '2026-06-30' },
      deferred: '',
      deferred_parsed: null,
      name: 'review-pr',
      priority: 'high',
      tags: ['work', 'code'],
      parent: 'sprint-tasks',
      depends_on: ['write-code'],
      blocked: false,
      recur: 'weekly:1',
      alerts: ['2026-06-30 09:00'],
      extra_attrs: { effort: '2h' },
    };
    const line = toMarkdown(original);
    // Verify all fields are present
    expect(line).toContain('- [ ] Review PR');
    expect(line).toContain('[due: ');

<｜｜DSML｜｜parameter name="content" string="true">    expect(line).toContain('[name: ');
    expect(line).toContain('[priority: ');
    expect(line).toContain('[parent: ');
    expect(line).toContain('[recur: ');
    expect(line).toContain('[alerts: ');
    expect(line).toContain('[dependsOn: ');
    expect(line).toContain('[effort: ');
  });
});

describe('formatWikiLinks', () => {
  it('converts wiki links to HTML links', () => {
    const result = formatWikiLinks('See [[Journal/2026-06-30]] for notes', 'https://notes.example.com');
    expect(result).toContain('<a href="https://notes.example.com/Journal%2F2026-06-30">Journal/2026-06-30</a>');
  });

  it('handles multiple wiki links', () => {
    const result = formatWikiLinks('[[Page One]] and [[Page Two]]', 'https://notes.test');
    expect(result).toContain('<a href="https://notes.test/Page%20One">Page One</a>');
    expect(result).toContain('<a href="https://notes.test/Page%20Two">Page Two</a>');
  });

  it('leaves non-wiki text unchanged', () => {
    const result = formatWikiLinks('Just plain text', 'https://notes.test');
    expect(result).toBe('Just plain text');
  });
});

describe('formatJournalLink', () => {
  it('formats a date as journal link', () => {
    expect(formatJournalLink('2026-06-30')).toBe('[[Journal/2026-06-30]]');
  });

  it('formats with time', () => {
    expect(formatJournalLink('2026-06-30', '14:00')).toBe('[[Journal/2026-06-30]] 14:00');
  });
});

describe('parseJournalLink', () => {
  it('parses a journal link', () => {
    const result = parseJournalLink('[[Journal/2026-06-30]]');
    expect(result).toEqual({ date: '2026-06-30' });
  });

  it('parses a journal link with time', () => {
    const result = parseJournalLink('[[Journal/2026-06-30]] 14:00');
    expect(result).toEqual({ date: '2026-06-30', time: '14:00' });
  });

  it('returns null for non-journal values', () => {
    expect(parseJournalLink('just a date string')).toBeNull();
    expect(parseJournalLink('')).toBeNull();
  });
});