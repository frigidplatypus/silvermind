import { describe, it, expect, beforeEach } from 'vitest';
import type { SbClient } from '../sb-client';
import type { Task, SilverBulletPage } from '../task-types';
import { parseTaskLine, parseTasksFromPage, findNthTask } from '../task-parser';
import { toMarkdown } from '../task-serializer';
import { toggleDone, toggleUndone, modifyTask, deleteTask, archiveTasks } from '../task-operations';

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    page: 'Tasks',
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

function mockSbClient(initialPage: string = ''): {
  client: SbClient;
  getPage: () => string;
  getPageWrites: () => string[];
  setLastModified: (ts: number) => void;
} {
  let pageContent = initialPage;
  let lastModified = 1;
  const writeLog: string[] = [];

  const client: SbClient = {
    readPage: async (_path: string): Promise<SilverBulletPage> => {
      return { content: pageContent, lastModified };
    },
    writePage: async (_path: string, content: string): Promise<void> => {
      pageContent = content;
      lastModified++;
      writeLog.push(content);
    },
    readModifyWrite: async (
      path: string,
      fn: (content: string) => Promise<string>,
      _maxRetries = 3,
    ): Promise<void> => {
      const page = await client.readPage(path);
      const modified = await fn(page.content);
      await client.writePage(path, modified);
    },
    queryTasks: async () => [],
    getTask: async () => null,
    findPagesByTag: async () => [],
    getBaseURL: () => 'https://test.example.com',
  };

  return {
    client,
    getPage: () => pageContent,
    getPageWrites: () => writeLog,
    setLastModified: (ts: number) => {
      lastModified = ts;
    },
  };
}

function taskFromPage(content: string, position: number): Task {
  const tasks = parseTasksFromPage(content, 'Tasks');
  const t = tasks.find((t) => t.position === position);
  if (!t) throw new Error(`Task not found at position ${position}`);
  return t;
}

describe('modifyTask', () => {
  let mock: ReturnType<typeof mockSbClient>;

  beforeEach(() => {
    mock = mockSbClient();
  });

  function setupPage(content: string) {
    mock = mockSbClient(content);
  }

  it('modifies task text', async () => {
    setupPage('- [ ] Old text\n');
    const task = baseTask({ text: 'Old text' });
    const result = await modifyTask(task, { text: 'New text' }, mock.client);

    expect(result.text).toBe('New text');
    const saved = taskFromPage(mock.getPage(), 1);
    expect(saved.text).toBe('New text');
  });

  it('modifies task status to done', async () => {
    setupPage('- [ ] Status change\n');
    const task = baseTask({ text: 'Status change' });
    const result = await modifyTask(task, { status: 'x' }, mock.client);

    expect(result.status).toBe('x');
    expect(result.done).toBe(true);
    const saved = taskFromPage(mock.getPage(), 1);
    expect(saved.status).toBe('x');
    expect(mock.getPage()).toContain('[x]');
  });

  it('modifies task status to waiting', async () => {
    setupPage('- [ ] Status change\n');
    const task = baseTask({ text: 'Status change' });
    const result = await modifyTask(task, { status: 'waiting' }, mock.client);

    expect(result.status).toBe('waiting');
    const saved = taskFromPage(mock.getPage(), 1);
    expect(saved.status).toBe('waiting');
    expect(mock.getPage()).toContain('[waiting]');
  });

  it('modifies task priority', async () => {
    setupPage('- [ ] Priority test\n');
    const task = baseTask({ text: 'Priority test' });
    const result = await modifyTask(task, { priority: 'high' }, mock.client);

    expect(result.priority).toBe('high');
    expect(mock.getPage()).toContain('[priority: "high"]');
  });

  it('modifies task due date', async () => {
    setupPage('- [ ] Due test\n');
    const task = baseTask({ text: 'Due test' });
    const result = await modifyTask(task, { due: '[[Journal/2026-12-31]]' }, mock.client);

    expect(result.due).toBe('[[Journal/2026-12-31]]');
    expect(mock.getPage()).toContain('[due: "[[Journal/2026-12-31]]"]');
  });

  it('modifies task deferred date', async () => {
    setupPage('- [ ] Deferred test\n');
    const task = baseTask({ text: 'Deferred test' });
    const result = await modifyTask(task, { deferred: '[[Journal/2026-07-15]]' }, mock.client);

    expect(result.deferred).toBe('[[Journal/2026-07-15]]');
    expect(mock.getPage()).toContain('[deferred: "[[Journal/2026-07-15]]"]');
  });

  it('modifies task tags', async () => {
    setupPage('- [ ] Tag test #old\n');
    const task = baseTask({ text: 'Tag test', tags: ['old'] });
    const result = await modifyTask(task, { tags: ['new', 'urgent'] }, mock.client);

    expect(result.tags).toContain('new');
    expect(result.tags).toContain('urgent');
    const saved = taskFromPage(mock.getPage(), 1);
    expect(saved.tags).toContain('new');
    expect(saved.tags).toContain('urgent');
  });

  it('modifies task name', async () => {
    setupPage('- [ ] Name test\n');
    const task = baseTask({ text: 'Name test' });
    const result = await modifyTask(task, { name: 'unique-name' }, mock.client);

    expect(result.name).toBe('unique-name');
    expect(mock.getPage()).toContain('[name: "unique-name"]');
  });

  it('modifies task alerts', async () => {
    setupPage('- [ ] Alert test\n');
    const task = baseTask({ text: 'Alert test' });
    const result = await modifyTask(task, { alerts: ['2026-07-01 09:00'] }, mock.client);

    expect(result.alerts).toEqual(['2026-07-01 09:00']);
    expect(mock.getPage()).toContain('[alerts: "2026-07-01 09:00"]');
  });

  it('modifies extra_attrs', async () => {
    setupPage('- [ ] Extra test\n');
    const task = baseTask({ text: 'Extra test' });
    const result = await modifyTask(
      task,
      { extra_attrs: { effort: '3h', milestone: 'Q3' } },
      mock.client,
    );

    expect(result.extra_attrs).toEqual({ effort: '3h', milestone: 'Q3' });
    expect(mock.getPage()).toContain('[effort: "3h"]');
    expect(mock.getPage()).toContain('[milestone: "Q3"]');
  });

  it('modifies multiple fields at once', async () => {
    setupPage('- [ ] Multi field test\n');
    const task = baseTask({ text: 'Multi field test' });
    const result = await modifyTask(
      task,
      {
        text: 'Updated text',
        priority: 'high',
        due: '[[Journal/2026-12-31]]',
        recur: 'weekly:1',
        tags: ['important'],
        depends_on: ['prerequisite'],
      },
      mock.client,
    );

    expect(result.text).toBe('Updated text #important');
    expect(result.priority).toBe('high');
    expect(result.due).toBe('[[Journal/2026-12-31]]');
    expect(result.recur).toBe('weekly:1');
    expect(result.tags).toContain('important');
    expect(result.depends_on).toEqual(['prerequisite']);
    const page = mock.getPage();
    expect(page).toContain('#important');
    expect(page).toContain('[priority: "high"]');
    expect(page).toContain('[due: "[[Journal/2026-12-31]]"]');
    expect(page).toContain('[recur: "weekly:1"]');
    expect(page).toContain('[dependsOn: "prerequisite"]');
  });

  it('clears due when empty string is passed', async () => {
    setupPage('- [ ] Clear due [due: "[[Journal/2026-12-31]]"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { due: '' }, mock.client);

    expect(result.due).toBe('');
    expect(mock.getPage()).not.toContain('due:');
    expect(mock.getPage()).not.toContain('2026-12-31');
  });

  it('clears deferred when empty string is passed', async () => {
    setupPage('- [ ] Clear deferred [deferred: "[[Journal/2026-07-15]]"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { deferred: '' }, mock.client);

    expect(result.deferred).toBe('');
    expect(mock.getPage()).not.toContain('deferred:');
  });

  it('clears priority when empty string is passed', async () => {
    setupPage('- [ ] Clear prio [priority: "high"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { priority: '' }, mock.client);

    expect(result.priority).toBe('');
    expect(mock.getPage()).not.toContain('priority:');
  });

  it('clears name when empty string is passed', async () => {
    setupPage('- [ ] Clear name [name: "my-task"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { name: '' }, mock.client);

    expect(result.name).toBe('');
    expect(mock.getPage()).not.toContain('name:');
  });

  it('clears recur when empty string is passed', async () => {
    setupPage('- [ ] Clear recur [recur: "daily:1"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { recur: '' }, mock.client);

    expect(result.recur).toBeFalsy();
    expect(mock.getPage()).not.toContain('recur:');
  });

  it('clears tags with empty array', async () => {
    setupPage('- [ ] Clear tags #old1 #old2\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { tags: [] }, mock.client);

    expect(result.tags).toEqual([]);
    expect(mock.getPage()).not.toContain('#old1');
    expect(mock.getPage()).not.toContain('#old2');
  });

  it('clears depends_on with empty array', async () => {
    setupPage('- [ ] Clear deps [dependsOn: "step1, step2"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { depends_on: [] }, mock.client);

    expect(result.depends_on).toEqual([]);
    expect(mock.getPage()).not.toContain('dependsOn:');
  });

  it('clears alerts with empty array', async () => {
    setupPage('- [ ] Clear alerts [alerts: "2026-07-01 09:00"]\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await modifyTask(task, { alerts: [] }, mock.client);

    expect(result.alerts).toEqual([]);
    expect(mock.getPage()).not.toContain('alerts:');
  });

  it('does not modify page when text is unchanged', async () => {
    setupPage('- [ ] Same text\n');
    const task = baseTask({ text: 'Same text' });
    const result = await modifyTask(task, { text: 'Same text' }, mock.client);

    expect(result.text).toBe('Same text');
    expect(mock.getPage()).toContain('- [ ] Same text');
  });

  it('silently returns content unchanged when task not found at position', async () => {
    setupPage('- [ ] Only one task\n');
    const task = baseTask({ position: 99, text: 'Ghost' });
    const result = await modifyTask(task, { text: 'New text' }, mock.client);

    expect(result.text).toBe('New text');
    expect(mock.getPage()).toContain('Only one task');
    expect(mock.getPage()).not.toContain('New text');
  });

  it('edits a task that was changed to different status by another client', async () => {
    setupPage('- [x] Already done\n');
    const task = baseTask({ text: 'Already done', status: '', done: false });
    const result = await modifyTask(task, { priority: 'high' }, mock.client);

    expect(result.priority).toBe('high');
    expect(mock.getPage()).toContain('[priority: "high"]');
    expect(mock.getPage()).toContain('[x] Already done');
  });

  it('modifies status from done to active', async () => {
    setupPage('- [x] Done task\n');
    const task = taskFromPage(mock.getPage(), 1);
    expect(task.status).toBe('x');
    const result = await modifyTask(task, { status: '' }, mock.client);

    expect(result.status).toBe('');
    expect(mock.getPage()).toContain('[ ]');
    expect(mock.getPage()).not.toContain('[x]');
  });

  it('modifies the correct task when multiple tasks exist on page', async () => {
    setupPage('- [ ] First task\n- [ ] Second task\n- [ ] Third task\n');
    const task = baseTask({ position: 2, text: 'Second task' });
    const result = await modifyTask(task, { text: 'Modified second' }, mock.client);

    expect(result.text).toBe('Modified second');
    const lines = mock.getPage().trim().split('\n');
    expect(lines[0]).toContain('First task');
    expect(lines[1]).toContain('Modified second');
    expect(lines[2]).toContain('Third task');
  });

  it('modifies duplicate task text by position', async () => {
    setupPage('- [ ] Duplicate task [priority: "low"]\n- [ ] Duplicate task [priority: "high"]\n');
    const task = baseTask({ position: 2, text: 'Duplicate task' });
    const result = await modifyTask(task, { priority: 'medium' }, mock.client);

    expect(result.priority).toBe('medium');
    const lines = mock.getPage().trim().split('\n');
    expect(lines[0]).toContain('[priority: "low"]');
    expect(lines[1]).toContain('[priority: "medium"]');
    expect(lines[1]).not.toContain('[priority: "high"]');
  });

  it('rejects invalid status with colon', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await expect(modifyTask(task, { status: 'bad:value' }, mock.client)).rejects.toThrow(
      /status.*colon|status.*:/,
    );
  });

  it('rejects invalid priority', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await expect(modifyTask(task, { priority: 'extreme' }, mock.client)).rejects.toThrow(
      /priority.*high.*medium.*low/,
    );
  });

  it('rejects invalid recur format', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await expect(modifyTask(task, { recur: 'yearly' }, mock.client)).rejects.toThrow(
      /recur.*daily.*weekly.*monthly.*yearly/,
    );
  });

  it('rejects invalid tag characters', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await expect(modifyTask(task, { tags: ['bad tag'] }, mock.client)).rejects.toThrow(
      /invalid tag/,
    );
  });

  it('rejects invalid alert format', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await expect(modifyTask(task, { alerts: ['not-a-date'] }, mock.client)).rejects.toThrow(
      /alert.*YYYY-MM-DD/,
    );
  });

  it('accepts valid status change', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await modifyTask(task, { status: 'waiting' }, mock.client);
    expect(mock.getPage()).toContain('[waiting]');
  });

  it('accepts valid priority change', async () => {
    setupPage('- [ ] Test\n');
    const task = baseTask({ text: 'Test' });
    await modifyTask(task, { priority: 'high' }, mock.client);
    expect(mock.getPage()).toContain('[priority: "high"]');
  });
});

describe('toggleDone', () => {
  let mock: ReturnType<typeof mockSbClient>;

  function setupPage(content: string) {
    mock = mockSbClient(content);
  }

  it('marks an active task as done', async () => {
    setupPage('- [ ] Complete me\n');
    const task = baseTask({ text: 'Complete me' });
    const result = await toggleDone(task, mock.client);

    expect(result.done).toBe(true);
    expect(result.status).toBe('x');
    const page = mock.getPage();
    expect(page).toContain('[x] Complete me');
    expect(page).not.toContain('[ ] Complete me');
  });

  it('returns fresh data from the on-disk parse', async () => {
    setupPage('- [ ] Buy milk #groceries [priority: "high"]\n');
    const task = baseTask({ text: 'Buy milk' });
    const result = await toggleDone(task, mock.client);

    expect(result.text).toBe('Buy milk');
    expect(result.tags).toContain('groceries');
    expect(result.priority).toBe('high');
    expect(result.done).toBe(true);
  });

  it('marks a done task as done again (idempotent)', async () => {
    setupPage('- [x] Already done\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await toggleDone(task, mock.client);

    expect(result.done).toBe(true);
    expect(result.status).toBe('x');
    expect(mock.getPage()).toContain('[x] Already done');
  });

  it('throws when task not found at position', async () => {
    setupPage('- [ ] Only one\n');
    const task = baseTask({ position: 99, text: 'Missing' });
    await expect(toggleDone(task, mock.client)).rejects.toThrow('task not found');
  });

  it('creates next occurrence for recurring task (daily)', async () => {
    setupPage('- [ ] Daily task [due: "[[Journal/2026-07-01]]"] [recur: "daily:1"]\n');
    const task = baseTask({
      text: 'Daily task',
      due: '[[Journal/2026-07-01]]',
      recur: 'daily:1',
    });
    const result = await toggleDone(task, mock.client);

    expect(result.done).toBe(true);
    const page = mock.getPage();
    const lines = page.trim().split('\n');
    expect(lines[0]).toContain('[x] Daily task');
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('[ ] Daily task');
    expect(lines[1]).toContain('[due: "[[Journal/2026-07-02]]"]');
  });

  it('creates next occurrence for recurring task (weekly)', async () => {
    setupPage('- [ ] Weekly review [due: "[[Journal/2026-07-01]]"] [recur: "weekly:1"]\n');
    const task = baseTask({
      text: 'Weekly review',
      due: '[[Journal/2026-07-01]]',
      recur: 'weekly:1',
    });
    await toggleDone(task, mock.client);

    const page = mock.getPage();
    expect(page).toContain('[x] Weekly review');
    expect(page).toContain('[[Journal/2026-07-08]]');
  });

  it('creates next occurrence for recurring task (monthly:1)', async () => {
    setupPage('- [ ] Monthly checkup [due: "[[Journal/2026-07-15]]"] [recur: "monthly:1"]\n');
    const task = baseTask({
      text: 'Monthly checkup',
      due: '[[Journal/2026-07-15]]',
      recur: 'monthly:1',
    });
    await toggleDone(task, mock.client);

    const page = mock.getPage();
    expect(page).toContain('[x] Monthly checkup');
    expect(page).toContain('[[Journal/2026-08-15]]');
  });

  it('next occurrence preserves name, priority, depends_on, extra_attrs', async () => {
    setupPage(
      '- [ ] Complete project [due: "[[Journal/2026-07-01]]"] [name: "proj-done"] [priority: "high"] [dependsOn: "setup"] [recur: "daily:1"] [effort: "2h"]\n',
    );
    const task = baseTask({
      text: 'Complete project',
      due: '[[Journal/2026-07-01]]',
      name: 'proj-done',
      priority: 'high',
      depends_on: ['setup'],
      recur: 'daily:1',
      extra_attrs: { effort: '2h' },
    });
    await toggleDone(task, mock.client);

    const page = mock.getPage();
    const nextLine = page.trim().split('\n')[1];
    expect(nextLine).toContain('[name: "proj-done"]');
    expect(nextLine).toContain('[priority: "high"]');
    expect(nextLine).toContain('[dependsOn: "setup"]');
    expect(nextLine).toContain('[effort: "2h"]');
  });

  it('next occurrence does not inherit alerts', async () => {
    setupPage(
      '- [ ] Review [due: "[[Journal/2026-07-01]]"] [recur: "weekly:1"] [alerts: "2026-07-04 09:00"]\n',
    );
    const task = baseTask({
      text: 'Review',
      due: '[[Journal/2026-07-01]]',
      recur: 'weekly:1',
      alerts: ['2026-07-04 09:00'],
    });
    await toggleDone(task, mock.client);

    const page = mock.getPage();
    const nextLine = page.trim().split('\n')[1];
    expect(nextLine).not.toContain('alerts:');
  });

  it('does not create next occurrence when task has no recurrence', async () => {
    setupPage('- [ ] Non-recurring task\n');
    const task = baseTask({ text: 'Non-recurring task' });
    await toggleDone(task, mock.client);

    const lines = mock.getPage().trim().split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('[x] Non-recurring task');
  });

  it('marks duplicate task text done by position', async () => {
    setupPage('- [ ] Duplicate task [priority: "low"]\n- [ ] Duplicate task [priority: "high"]\n');
    const task = baseTask({ position: 2, text: 'Duplicate task' });
    const result = await toggleDone(task, mock.client);

    expect(result.done).toBe(true);
    const lines = mock.getPage().trim().split('\n');
    expect(lines[0]).toContain('- [ ] Duplicate task');
    expect(lines[0]).toContain('[priority: "low"]');
    expect(lines[1]).toContain('- [x] Duplicate task');
    expect(lines[1]).toContain('[priority: "high"]');
  });
});

describe('toggleUndone', () => {
  let mock: ReturnType<typeof mockSbClient>;

  function setupPage(content: string) {
    mock = mockSbClient(content);
  }

  it('marks a done task as active', async () => {
    setupPage('- [x] Undo me\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await toggleUndone(task, mock.client);

    expect(result.done).toBe(false);
    expect(result.status).toBe('');
    const page = mock.getPage();
    expect(page).toContain('[ ] Undo me');
    expect(page).not.toContain('[x] Undo me');
  });

  it('skips when task is already active', async () => {
    setupPage('- [ ] Already active\n');
    const task = taskFromPage(mock.getPage(), 1);
    const result = await toggleUndone(task, mock.client);

    expect(result.done).toBe(false);
    expect(mock.getPage()).toContain('[ ] Already active');
  });

  it('silently returns unchanged content when task not found', async () => {
    setupPage('- [x] Only one\n');
    const task = baseTask({ position: 99 });
    const result = await toggleUndone(task, mock.client);

    expect(result.done).toBe(false);
    expect(mock.getPage()).toContain('[x] Only one');
  });

  it('removes recurrence next occurrence when undoing', async () => {
    setupPage(
      '- [x] Daily task [due: "[[Journal/2026-07-01]]"] [recur: "daily:1"]\n' +
        '- [ ] Daily task [due: "[[Journal/2026-07-02]]"] [recur: "daily:1"]\n',
    );
    const task = taskFromPage(mock.getPage(), 1);
    const result = await toggleUndone(task, mock.client);

    expect(result.done).toBe(false);
    const lines = mock.getPage().trim().split('\n');
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain('[ ] Daily task');
    expect(lines[0]).not.toContain('[x]');
  });

  it('removes recurrence child by name match', async () => {
    setupPage(
      '- [x] Named task [due: "[[Journal/2026-07-01]]"] [recur: "monthly:1"] [name: "named"]\n' +
        '- [ ] Named task [due: "[[Journal/2026-08-01]]"] [recur: "monthly:1"] [name: "named"]\n',
    );
    const task = taskFromPage(mock.getPage(), 1);
    const result = await toggleUndone(task, mock.client);

    expect(result.done).toBe(false);
    const lines = mock.getPage().trim().split('\n');
    expect(lines.length).toBe(1);
  });

  it('keeps recurrence child when name differs', async () => {
    setupPage(
      '- [x] Named task [due: "[[Journal/2026-07-01]]"] [recur: "monthly:1"] [name: "task-a"]\n' +
        '- [ ] Named task [due: "[[Journal/2026-08-01]]"] [recur: "monthly:1"] [name: "task-b"]\n',
    );
    const task = taskFromPage(mock.getPage(), 1);
    await toggleUndone(task, mock.client);

    const lines = mock.getPage().trim().split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toContain('[ ]');
    expect(lines[1]).toContain('[ ]');
  });
});

describe('deleteTask', () => {
  it('removes a task line from the page', async () => {
    const mock = mockSbClient('- [ ] Task one\n- [ ] Task two\n- [ ] Task three\n');
    const task = baseTask({ position: 2, text: 'Task two' });
    await deleteTask(task, mock.client);

    const page = mock.getPage();
    expect(page).toContain('Task one');
    expect(page).toContain('Task three');
    expect(page).not.toContain('Task two');
  });

  it('silently returns unchanged content when task not found', async () => {
    const mock = mockSbClient('- [ ] Only one\n');
    const task = baseTask({ position: 99 });
    await deleteTask(task, mock.client);

    expect(mock.getPage()).toContain('Only one');
  });
});

describe('archiveTasks', () => {
  it('moves done tasks under a Task Archive header', async () => {
    const mock = mockSbClient('- [ ] Active task\n- [x] Done task\n- [ ] Another active\n');
    const result = await archiveTasks('Tasks', mock.client);

    expect(result.archived).toBe(1);
    const page = mock.getPage();
    expect(page).toContain('## Task Archive');
    expect(page).toContain('- [ ] Active task');
    expect(page).toContain('- [ ] Another active');
    const archiveIndex = page.indexOf('## Task Archive');
    const doneIndex = page.indexOf('Done task');
    expect(doneIndex).toBeGreaterThan(archiveIndex);
  });

  it('appends to existing Task Archive section', async () => {
    const mock = mockSbClient('- [ ] Active\n- [x] New done\n## Task Archive\n- [x] Old done\n');
    const result = await archiveTasks('Tasks', mock.client);

    expect(result.archived).toBe(1);
    const page = mock.getPage();
    const doneTasks = page.split('\n').filter((l) => l.includes('[x]'));
    expect(doneTasks.length).toBe(2);
  });

  it('does nothing when there are no done tasks', async () => {
    const mock = mockSbClient('- [ ] Task one\n- [ ] Task two\n');
    const result = await archiveTasks('Tasks', mock.client);

    expect(result.archived).toBe(0);
    expect(mock.getPage()).not.toContain('## Task Archive');
  });
});
