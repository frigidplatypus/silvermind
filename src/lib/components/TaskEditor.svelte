<script lang="ts">
  import type { Task } from '$lib/types/task';
  import { updateTask, markTaskDone, undoTask, deleteTask } from '$lib/api/tasks';
  import { notifySuccess } from '$lib/native/haptics';
  import { getTaskNames, loadTaskNames } from '$lib/stores/tasknames.svelte';
  import Icon from './Icon.svelte';
  import Autocomplete from './Autocomplete.svelte';

  let {
    task,
    onclose,
    onsaved,
    mode = 'fullscreen',
  }: {
    task: Task;
    onclose: () => void;
    onsaved?: (updated: Task) => void;
    mode?: 'fullscreen' | 'modal';
  } = $props();

  let text = $state(task.text);
  let status = $state(task.status || '');
  let priority = $state(task.priority || 'none');
  let due = $state(task.due || '');
  let scheduled = $state(task.scheduled || '');
  let recur = $state(task.recur || '');
  let deps = $state<string[]>([...(task.depends_on || [])]);
  let parent = $state(task.parent || '');
  let showAdvanced = $state(!!(task.recur || (task.depends_on && task.depends_on.length > 0) || task.parent));
  let isSaving = $state(false);
  let showDeleteConfirm = $state(false);

  const taskNames = $derived(getTaskNames());

  async function handleSave() {
    isSaving = true;
    try {
      const fields: Record<string, unknown> = {};
      if (text !== task.text) fields.text = text;
      if (status !== (task.status || '')) fields.status = status;
      if (priority !== (task.priority || 'none')) fields.priority = priority;
      if (due !== (task.due || '')) fields.due = due || '';
      if (scheduled !== (task.scheduled || '')) fields.scheduled = scheduled || '';
      if (recur !== (task.recur || '')) fields.recur = recur || '';
      const oldDeps = (task.depends_on || []).join(',');
      const newDeps = deps.join(',');
      if (newDeps !== oldDeps) fields.depends_on = deps;
      if (parent !== (task.parent || '')) fields.parent = parent || '';

      if (Object.keys(fields).length === 0) { onclose(); return; }
      const updated = await updateTask(task.page, task.position, fields);
      notifySuccess();
      onsaved?.(updated);
      onclose();
    } catch { } finally { isSaving = false; }
  }

  async function handleToggleDone() {
    try {
      const updated = task.done
        ? await undoTask(task.page, task.position)
        : await markTaskDone(task.page, task.position);
      notifySuccess();
      onsaved?.(updated);
      onclose();
    } catch { }
  }

  async function handleDelete() {
    try {
      await deleteTask(task.page, task.position);
      notifySuccess();
      onsaved?.(task);
      onclose();
    } catch { }
  }
</script>

{#snippet formContent()}
  <label class="field-label" for="edit-text">Text</label>
  <textarea id="edit-text" class="text-input" bind:value={text} rows={6} placeholder="Task text (markdown)…"></textarea>

  <label class="field-label" for="edit-status">Status</label>
  <select id="edit-status" class="field" bind:value={status}>
    <option value="">Active</option>
    <option value="waiting">Waiting</option>
    <option value="maybe">Maybe</option>
  </select>

  <label class="field-label" for="edit-priority">Priority</label>
  <select id="edit-priority" class="field" bind:value={priority}>
    <option value="none">None</option>
    <option value="low">Low</option>
    <option value="medium">Medium</option>
    <option value="high">High</option>
  </select>

  <label class="field-label" for="edit-due">Due date</label>
  <input id="edit-due" type="text" class="field" bind:value={due} placeholder="2026-06-25 or tomorrow" />

  <label class="field-label" for="edit-scheduled">Scheduled date</label>
  <input id="edit-scheduled" type="text" class="field" bind:value={scheduled} placeholder="2026-06-20" />

  <button class="advanced-toggle" onclick={() => (showAdvanced = !showAdvanced)}>
    <Icon name={showAdvanced ? 'chevron-down' : 'chevron-right'} size="0.875rem" />
    <span>Advanced</span>
  </button>

  {#if showAdvanced}
    <label class="field-label" for="ac-parent">Parent task</label>
    <Autocomplete id="ac-parent" items={taskNames} placeholder="Search tasks…" onselect={(name) => (parent = name)} />
    {#if parent}
      <div class="chip-row">
        <span class="chip"><Icon name="corner-right-up" size="0.75rem" /> {parent} <button class="chip-remove" onclick={() => (parent = '')} aria-label="Remove parent">×</button></span>
      </div>
    {/if}

    <label class="field-label" for="edit-recur">Recurrence</label>
    <select id="edit-recur" class="field" bind:value={recur}>
      <option value="">None</option>
      <option value="daily:1">Daily</option>
      <option value="weekly:1">Weekly</option>
      <option value="monthly:1">Monthly</option>
      <option value="yearly:1">Yearly</option>
    </select>

    <label class="field-label" for="ac-deps">Dependencies</label>
    <Autocomplete id="ac-deps" items={taskNames} placeholder="Add dependency…" onselect={(name) => { if (!deps.includes(name)) deps = [...deps, name]; }} />
    {#if deps.length > 0}
      <div class="chip-row">
        {#each deps as dep}
          <span class="chip"><Icon name="link" size="0.75rem" /> {dep} <button class="chip-remove" onclick={() => (deps = deps.filter(d => d !== dep))} aria-label="Remove {dep}">×</button></span>
        {/each}
      </div>
    {/if}
  {/if}

  <div class="meta-row"><span class="meta-label">Page</span><span class="meta-value">{task.page}</span></div>
  <div class="meta-row"><span class="meta-label">Position</span><span class="meta-value">{task.position}</span></div>

  <div class="delete-section">
    {#if showDeleteConfirm}
      <p>Delete this task permanently?</p>
      <div class="confirm-row">
        <button class="cancel-btn" onclick={() => (showDeleteConfirm = false)}>Cancel</button>
        <button class="confirm-delete-btn" onclick={handleDelete}>Delete</button>
      </div>
    {:else}
      <button class="delete-trigger" onclick={() => (showDeleteConfirm = true)}><Icon name="trash-2" /> Delete task</button>
    {/if}
  </div>
{/snippet}

{#if mode === 'modal'}
  <div class="modal-overlay" onclick={onclose} role="dialog" aria-label="Edit task">
    <div class="modal-dialog" onclick={(e) => e.stopPropagation()} role="document">
      <div class="modal-header">
        <h2 class="modal-title">Edit Task</h2>
        <div class="modal-actions">
          <button class="done-btn" onclick={handleToggleDone} aria-label={task.done ? 'Mark active' : 'Mark done'}>
            <Icon name={task.done ? 'rotate-ccw' : 'check'} /> {task.done ? 'Undo' : 'Done'}
          </button>
          <button class="save-btn" onclick={handleSave} disabled={isSaving || !text.trim()}>
            {isSaving ? '...' : 'Save'}
          </button>
          <button class="close-btn" onclick={onclose} aria-label="Close"><Icon name="x" /></button>
        </div>
      </div>
      <div class="modal-body">
        {@render formContent()}
      </div>
    </div>
  </div>
{:else}
  <div class="editor">
    <div class="editor-header">
      <button class="back-btn" onclick={onclose} aria-label="Back">‹ Back</button>
      <div class="header-actions">
        <button class="done-btn" onclick={handleToggleDone} aria-label={task.done ? 'Mark active' : 'Mark done'}>
          <Icon name={task.done ? 'rotate-ccw' : 'check'} /> {task.done ? 'Undo' : 'Done'}
        </button>
        <button class="save-btn" onclick={handleSave} disabled={isSaving || !text.trim()}>
          {isSaving ? '...' : 'Save'}
        </button>
      </div>
    </div>

    <div class="editor-body">
      {@render formContent()}
    </div>
  </div>
{/if}

<style>
  .editor { position: fixed; inset: 0; z-index: 300; background: var(--color-bg); display: flex; flex-direction: column; }
  .modal-overlay { position: fixed; inset: 0; z-index: 300; background: var(--color-overlay); display: flex; align-items: center; justify-content: center; }
  .modal-dialog { background: var(--color-surface); border-radius: var(--radius-xl); width: min(640px, 90vw); max-height: 85vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
  .modal-header { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; border-bottom: 0.5px solid var(--color-separator); }
  .modal-title { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-text); }
  .modal-actions { display: flex; gap: 0.5rem; align-items: center; }
  .modal-body { flex: 1; overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .close-btn { padding: 0.5rem; font-size: 1.125rem; color: var(--color-text-secondary); border-radius: var(--radius-md); width: 2.25rem; height: 2.25rem; display: flex; align-items: center; justify-content: center; }
  .editor-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; padding-top: max(0.75rem, var(--safe-area-top)); border-bottom: 0.5px solid var(--color-separator); background: var(--color-bg); }
  .back-btn { color: var(--color-accent); font-weight: 500; font-size: var(--font-size-base); }
  .header-actions { display: flex; gap: 0.5rem; align-items: center; }
  .done-btn { padding: 0.5rem 0.75rem; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-sm); color: var(--color-success); background: var(--color-success-light); }
  .save-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-accent); color: white; font-weight: 600; font-size: var(--font-size-sm); }
  .save-btn:disabled { opacity: 0.4; }
  .editor-body { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .field-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .text-input, .field { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font-size: var(--font-size-base); color: var(--color-text); font-family: inherit; outline: none; }
  .text-input:focus, .field:focus { border-color: var(--color-accent); }
  .text-input { resize: vertical; min-height: 120px; line-height: 1.6; }
  .advanced-toggle { display: flex; align-items: center; gap: 0.375rem; padding: 0.5rem 0; font-size: var(--font-size-sm); color: var(--color-accent); font-weight: 500; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-bg-tertiary); font-size: var(--font-size-xs); color: var(--color-text); }
  .chip-remove { padding: 0 0.125rem; font-size: 0.875rem; color: var(--color-text-secondary); }
  .meta-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-sm); }
  .meta-label { color: var(--color-text-secondary); }
  .meta-value { color: var(--color-text); }
  .delete-section { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-separator); }
  .delete-trigger { width: 100%; padding: 0.75rem; border-radius: var(--radius-md); color: var(--color-danger); font-weight: 600; font-size: var(--font-size-base); }
  .confirm-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .cancel-btn { flex: 1; padding: 0.5rem; border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--color-text-secondary); background: var(--color-bg-secondary); }
  .confirm-delete-btn { flex: 1; padding: 0.5rem; border-radius: var(--radius-md); background: var(--color-danger); color: white; font-weight: 600; font-size: var(--font-size-sm); }
</style>
