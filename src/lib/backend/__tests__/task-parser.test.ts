import { describe, it, expect } from 'vitest';
import { parseTaskLine, parseTasksFromPage, extractTags, stripAttributes } from '../task-parser';

describe('parseTaskLine', () => {
  it('parses a basic active task', () => {
    const task = parseTaskLine('- [ ] Buy milk', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.text).toBe('Buy milk');
    expect(task!.status).toBe('');
    expect(task!.done).toBe(false);
    expect(task!.page).toBe('Inbox');
    expect(task!.position).toBe(1);
  });

  it('parses a done task', () => {
    const task = parseTaskLine('- [x] Buy milk', 'Tasks', 1);
    expect(task).not.toBeNull();
    expect(task!.status).toBe('x');
    expect(task!.done).toBe(true);
  });

  it('parses a task with due date', () => {
    const task = parseTaskLine('- [ ] Buy milk [due: "2026-06-30"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.due).toBe('2026-06-30');
  });

  it('parses a task with priority', () => {
    const task = parseTaskLine('- [ ] Urgent task [priority: high]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.priority).toBe('high');
  });

  it('parses a task with tags', () => {
    const task = parseTaskLine('- [ ] Call Bob #phone #work/client', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.tags).toContain('phone');
    expect(task!.tags).toContain('work/client');
  });

  it('parses a task with recurrence', () => {
    const task = parseTaskLine('- [ ] Weekly review [recur: "weekly:1"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.recur).toBe('weekly:1');
  });

  it('parses a task with name and parent', () => {
    const task = parseTaskLine('- [ ] Sub-task [name: "sub1"] [parent: "main1"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.name).toBe('sub1');
    expect(task!.parent).toBe('main1');
  });

  it('parses a task with dependencies', () => {
    const task = parseTaskLine('- [ ] Step 3 [dependsOn: "step1, step2"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.depends_on).toEqual(['step1', 'step2']);
  });

  it('parses a task with alerts', () => {
    const task = parseTaskLine('- [ ] Meeting [alerts: "2026-07-01 09:00, 2026-07-01 08:30"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.alerts).toHaveLength(2);
  });

  it('parses a task with extra attributes', () => {
    const task = parseTaskLine('- [ ] Custom task [effort: "3h"] [assigned: "bob"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.extra_attrs).toBeDefined();
    expect(task!.extra_attrs!['effort']).toBe('3h');
    expect(task!.extra_attrs!['assigned']).toBe('bob');
  });

  it('returns null for non-task lines', () => {
    expect(parseTaskLine('## Header', 'Page', 1)).toBeNull();
    expect(parseTaskLine('Just text', 'Page', 1)).toBeNull();
    expect(parseTaskLine('', 'Page', 1)).toBeNull();
  });

  it('returns null for task line with no text', () => {
    expect(parseTaskLine('- [ ] [due: "2026-01-01"]', 'Page', 1)).toBeNull();
  });

  it('handles asterisk task marker', () => {
    const task = parseTaskLine('* [ ] Star task', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.text).toBe('Star task');
  });

  it('handles waiting status', () => {
    const task = parseTaskLine('- [waiting] Waiting task', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.status).toBe('waiting');
  });

  it('handles maybe status', () => {
    const task = parseTaskLine('- [maybe] Maybe later', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.status).toBe('maybe');
  });

  it('handles indented task', () => {
    const task = parseTaskLine('  - [ ] Indented task', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.text).toBe('Indented task');
  });

  it('strips duplicate tags', () => {
    const text = 'Task #tag #tag #other';
    const tags = extractTags(text);
    expect(tags).toEqual(['tag', 'other']);
  });

  it('strips attributes from text', () => {
    const result = stripAttributes('Buy milk [due: "2026-06-30"] [priority: high]');
    expect(result).toBe('Buy milk');
  });

  it('parses journal link due', () => {
    const task = parseTaskLine('- [ ] Review [due: "[[Journal/2026-06-30]]"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.due).toBe('[[Journal/2026-06-30]]');
  });

  it('parses quoted attribute values with spaces', () => {
    const task = parseTaskLine('- [ ] Task [name: "my custom name"]', 'Inbox', 1);
    expect(task).not.toBeNull();
    expect(task!.name).toBe('my custom name');
  });
});

describe('parseTasksFromPage', () => {
  it('parses multiple tasks from page content', () => {
    const content = `- [ ] Task one
- [x] Task two
- [ ] Task three [priority: high]`;
    const tasks = parseTasksFromPage(content, 'Test');
    expect(tasks).toHaveLength(3);
    expect(tasks[0].text).toBe('Task one');
    expect(tasks[1].done).toBe(true);
    expect(tasks[2].priority).toBe('high');
  });

  it('skips tasks under ## Task Archive header', () => {
    const content = `- [ ] Active task
## Task Archive
- [x] Archived task`;
    const tasks = parseTasksFromPage(content, 'Test');
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toBe('Active task');
  });

  it('returns empty array for empty content', () => {
    const tasks = parseTasksFromPage('', 'Test');
    expect(tasks).toHaveLength(0);
  });

  it('assigns incremental positions', () => {
    const content = `- [ ] First
- [ ] Second
- [ ] Third`;
    const tasks = parseTasksFromPage(content, 'Test');
    expect(tasks[0].position).toBe(1);
    expect(tasks[1].position).toBe(2);
    expect(tasks[2].position).toBe(3);
  });
});
