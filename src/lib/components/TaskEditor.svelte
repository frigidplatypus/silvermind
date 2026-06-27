<script lang="ts">
  import type { Task } from '$lib/types/task';
  import { updateTask, markTaskDone, undoTask, deleteTask } from '$lib/api/tasks';
  import { notifySuccess } from '$lib/native/haptics';
  import { getTaskNames, loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { getTagNames, loadTagNames } from '$lib/stores/tagnames.svelte';
  import { showError, showUndo } from '$lib/stores/toast.svelte';
  import Icon from './Icon.svelte';
  import Autocomplete from './Autocomplete.svelte';
  import { devLog } from '$lib/helpers/dev-log';
  import { scheduleForTask, cancelForTask } from '$lib/stores/notifications.svelte';

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
  let due = $state(task.due_parsed?.date || task.due || '');
  let deferred = $state(task.deferred_parsed?.date || task.deferred || '');
  let recur = $state(task.recur || '');
  let deps = $state<string[]>([...(task.depends_on || [])]);
  let parent = $state(task.parent || '');
  let isSaving = $state(false);
  let showDeleteConfirm = $state(false);
  let tags = $state<string[]>([...(task.tags || [])]);
  let tagQuery = $state('');
  let tagFocused = $state(false);
  let tagSelectedIndex = $state(0);
  let extraAttrs = $state<Record<string, string>>({ ...(task.extra_attrs || {}) });
  let extraAttrCounter = 0;
  let alerts = $state<string[]>([...(task.alerts || [])]);
  let newAlertDate = $state('');
  let newAlertTime = $state('');

  const originalDue = $derived(task.due_parsed?.date || task.due || '');
  const originalScheduled = $derived(task.deferred_parsed?.date || task.deferred || '');

  const hasChanges = $derived.by(() => {
    if (text !== task.text) return true;
    if (status !== (task.status || '')) return true;
    if (priority !== (task.priority || 'none')) return true;
    if (due !== originalDue) return true;
    if (deferred !== originalScheduled) return true;
    if (recur !== (task.recur || '')) return true;
    if (deps.join(',') !== (task.depends_on || []).join(',')) return true;
    if (parent !== (task.parent || '')) return true;
    if (tags.join(',') !== (task.tags || []).join(',')) return true;
    if (JSON.stringify(alerts) !== JSON.stringify(task.alerts || [])) return true;
    if (JSON.stringify(extraAttrs) !== JSON.stringify(task.extra_attrs || {})) return true;
    return false;
  });

  function handleAttemptClose() {
    if (hasChanges) {
      if (!confirm('Discard unsaved changes?')) return;
    }
    onclose();
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      handleAttemptClose();
    }
  }

  const taskNames = $derived(getTaskNames());
  const allTagNames = $derived(getTagNames());
  const tagFiltered = $derived(
    tagQuery.trim()
      ? allTagNames
          .filter((t) => t.toLowerCase().includes(tagQuery.toLowerCase()))
          .filter((t) => !tags.includes(t))
          .slice(0, 8)
      : [],
  );

  function addTag(name: string) {
    const trimmed = name.trim().replace(/^#/, '');
    if (trimmed && /^[\w\-\/.:]+$/.test(trimmed) && !tags.includes(trimmed)) {
      tags = [...tags, trimmed];
    }
  }

  function removeTag(name: string) {
    tags = tags.filter((t) => t !== name);
  }

  function handleTagKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); tagSelectedIndex = Math.min(tagSelectedIndex + 1, tagFiltered.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); tagSelectedIndex = Math.max(tagSelectedIndex - 1, 0); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      if (tagFiltered[tagSelectedIndex]) {
        addTag(tagFiltered[tagSelectedIndex]);
      } else if (tagQuery.trim()) {
        addTag(tagQuery);
      }
      tagQuery = '';
      tagSelectedIndex = 0;
    } else if (e.key === 'Escape') {
      tagFocused = false;
    }
  }

  function handleTagSelect(item: string) {
    addTag(item);
    tagQuery = '';
    tagSelectedIndex = 0;
    tagFocused = false;
  }

  $effect(() => { loadTagNames(); });

  async function handleSave() {
    isSaving = true;
    try {
      const fields: Record<string, unknown> = {};
      if (text !== task.text) fields.text = text;
      if (status !== (task.status || '')) fields.status = status;
      if (priority !== (task.priority || 'none')) fields.priority = priority === 'none' ? '' : priority;
      if (due !== originalDue) fields.due = due || '';
      if (deferred !== originalScheduled) fields.deferred = deferred || '';
      if (recur !== (task.recur || '')) fields.recur = recur || '';
      const oldDeps = (task.depends_on || []).join(',');
      const newDeps = deps.join(',');
      if (newDeps !== oldDeps) fields.depends_on = deps;
      if (parent !== (task.parent || '')) fields.parent = parent || '';
      const oldTags = (task.tags || []).join(',');
      const newTags = tags.join(',');
      if (newTags !== oldTags) fields.tags = tags;
      const oldExtra = JSON.stringify(task.extra_attrs || {});
      const newExtra = JSON.stringify(extraAttrs);
      if (newExtra !== oldExtra) fields.extra_attrs = { ...extraAttrs };
      const oldAlerts = JSON.stringify(task.alerts || []);
      const newAlerts = JSON.stringify(alerts);
      if (newAlerts !== oldAlerts) fields.alerts = alerts.length > 0 ? [...alerts] : [];

      if (Object.keys(fields).length === 0) { onclose(); return; }
      const updated = await updateTask(task.page, task.position, fields);
      notifySuccess();
      scheduleForTask(updated);
      onsaved?.(updated);
      onclose();
    } catch (e) {
      devLog('Save failed', e);
      showError(`Save failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally { isSaving = false; }
  }

  async function handleToggleDone() {
    try {
      if (task.done) {
        await undoTask(task.page, task.position);
      } else {
        await markTaskDone(task.page, task.position);
        cancelForTask(task);
        showUndo(`${(task.text || '').slice(0, 40)}${(task.text || '').length > 40 ? '…' : ''} marked done`, async () => {
          try { await undoTask(task.page, task.position); } catch {}
          onsaved?.(task);
        });
      }
      notifySuccess();
      onsaved?.(task);
      onclose();
    } catch (e) {
      devLog('Toggle done failed', e);
      showError(`Toggle done failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function handleDelete() {
    try {
      await deleteTask(task.page, task.position);
      cancelForTask(task);
      notifySuccess();
      onsaved?.(task);
      onclose();
    } catch (e) {
      devLog('Delete failed', e);
      showError(`Delete failed: ${e instanceof Error ? e.message : String(e)}`);
    }
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

  <label class="field-label" for="edit-tags">Tags</label>
  <div class="tag-input-wrapper">
    {#if tags.length > 0}
      <div class="chip-row tag-chips">
        {#each tags as tag}
          <span class="chip"><Icon name="tag" size="0.75rem" /> {tag} <button class="chip-remove" onclick={() => removeTag(tag)} aria-label="Remove {tag}">×</button></span>
        {/each}
      </div>
    {/if}
    <div class="tag-autocomplete">
      <input id="edit-tags" type="text" class="field tag-field" bind:value={tagQuery} placeholder="Add tag…"
        onfocus={() => { tagFocused = true; tagSelectedIndex = 0; }}
        onblur={() => setTimeout(() => (tagFocused = false), 150)}
        onkeydown={handleTagKeydown}
        autocomplete="off"
      />
      {#if tagFocused && tagFiltered.length > 0}
        <ul class="ac-dropdown" role="listbox">
          {#each tagFiltered as item, i}
            <li class="ac-item" class:selected={i === tagSelectedIndex} role="option" aria-selected={i === tagSelectedIndex}
              onpointerdown={(e) => { e.preventDefault(); handleTagSelect(item); }}>
              {item}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <label class="field-label" for="edit-due">Due date</label>
  <input id="edit-due" type="date" class="field" bind:value={due} />

  <label class="field-label" for="edit-deferred">Deferred date</label>
  <input id="edit-deferred" type="date" class="field" bind:value={deferred} />

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

  <label class="field-label">Alerts</label>
  {#if alerts.length > 0}
    <div class="chip-row alert-chips">
      {#each alerts as alert}
        <span class="chip alert-chip"><Icon name="bell" size="1rem" /> {alert} <button class="chip-remove" onclick={() => (alerts = alerts.filter(a => a !== alert))} aria-label="Remove alert">×</button></span>
      {/each}
    </div>
  {/if}
  <div class="alert-input-row">
    <input type="date" class="field alert-date" bind:value={newAlertDate} />
    <input type="time" class="field alert-time" bind:value={newAlertTime} />
    <button class="alert-add-btn" disabled={!newAlertDate || !newAlertTime}
      onclick={() => {
        const entry = `${newAlertDate} ${newAlertTime}`;
        if (!alerts.includes(entry)) alerts = [...alerts, entry];
        newAlertDate = '';
        newAlertTime = '';
      }}>+ Add</button>
  </div>

  <label class="field-label">Custom Attributes</label>
  <div class="extra-attrs">
    {#each Object.keys(extraAttrs) as key}
      <div class="extra-attr-row">
        <input type="text" class="field extra-key" value={key} placeholder="key"
          oninput={(e) => { const v = (e.target as HTMLInputElement).value; const val = extraAttrs[key]; delete extraAttrs[key]; extraAttrs[v] = val; extraAttrs = { ...extraAttrs }; }}
        />
        <input type="text" class="field extra-val" value={extraAttrs[key]} placeholder="value"
          oninput={(e) => { extraAttrs[key] = (e.target as HTMLInputElement).value; extraAttrs = { ...extraAttrs }; }}
        />
        <button class="extra-remove" onclick={() => { delete extraAttrs[key]; extraAttrs = { ...extraAttrs }; }} aria-label="Remove attribute"><Icon name="x" size="0.875rem" /></button>
      </div>
    {/each}
    <button class="extra-add" onclick={() => { extraAttrs[`__new_${++extraAttrCounter}`] = ''; extraAttrs = { ...extraAttrs }; }}>+ Add attribute</button>
  </div>

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
  <div class="modal-overlay" onclick={handleAttemptClose} onkeydown={handleOverlayKeydown} role="dialog" aria-modal="true" aria-label="Edit task" tabindex="-1">
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
          <button class="close-btn" onclick={handleAttemptClose} aria-label="Close"><Icon name="x" /></button>
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
      <button class="back-btn" onclick={handleAttemptClose} aria-label="Back"><Icon name="arrow-left" size="1rem" /> Back</button>
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
  .save-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-on-accent); font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm); }
  .save-btn:disabled { opacity: 0.4; }
  .editor-body { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
  .field-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .text-input, .field { width: 100%; padding: 0.625rem 0.75rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font-size: var(--font-size-base); color: var(--color-text); font-family: inherit; outline: none; }
  .text-input:focus, .field:focus { border-color: var(--color-accent); }
  .text-input { resize: vertical; min-height: 120px; line-height: 1.6; }
  .chip-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
  .chip { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-bg-tertiary); font-size: var(--font-size-xs); color: var(--color-text); }
  .ac-dropdown { position: absolute; top: 100%; left: 0; right: 0; z-index: 350; background: var(--color-surface); border: 1px solid var(--color-border); border-radius: var(--radius-md); box-shadow: 0 4px 12px var(--color-shadow); max-height: 14rem; overflow-y: auto; margin-top: 0.25rem; list-style: none; padding: 0.25rem; }
  .ac-item { padding: 0.5rem 0.75rem; font-size: var(--font-size-sm); color: var(--color-text); border-radius: var(--radius-sm); cursor: pointer; }
  .ac-item.selected, .ac-item:hover { background: var(--color-accent-light); color: var(--color-accent); }
  .chip-remove { padding: 0 0.125rem; font-size: 0.875rem; color: var(--color-text-secondary); }
  .tag-input-wrapper { display: flex; flex-direction: column; gap: 0.375rem; }
  .tag-chips { margin-bottom: 0.125rem; }
  .tag-autocomplete { position: relative; }
  .tag-field { padding: 0.5rem 0.625rem; font-size: var(--font-size-sm); }
  .tag-field::placeholder { color: var(--color-text-tertiary); }
  .extra-attrs { display: flex; flex-direction: column; gap: 0.375rem; }
  .extra-attr-row { display: flex; gap: 0.375rem; align-items: center; }
  .extra-key { flex: 0 0 7rem; padding: 0.375rem 0.5rem; font-size: var(--font-size-xs); font-family: monospace; }
  .extra-val { flex: 1; padding: 0.375rem 0.5rem; font-size: var(--font-size-xs); }
  .extra-remove { padding: 0.25rem; color: var(--color-text-secondary); border-radius: var(--radius-sm); flex-shrink: 0; }
  .extra-add { padding: 0.375rem 0.75rem; font-size: var(--font-size-xs); color: var(--color-accent); font-weight: 500; align-self: flex-start; }
  .alert-input-row { display: flex; gap: 0.375rem; align-items: center; }
  .alert-date { flex: 1; padding: 0.375rem 0.5rem; font-size: var(--font-size-xs); }
  .alert-time { flex: 1; padding: 0.375rem 0.5rem; font-size: var(--font-size-xs); }
  .alert-add-btn { padding: 0.375rem 0.75rem; border-radius: var(--radius-md); background: var(--color-accent); color: var(--color-on-accent); font-size: var(--font-size-xs); font-weight: 600; white-space: nowrap; }
  .alert-add-btn:disabled { opacity: 0.4; cursor: default; }
  .alert-chips { gap: 0.5rem; }
  .alert-chip { padding: 0.5rem 0.625rem; font-size: var(--font-size-sm); gap: 0.5rem; border: 1px solid var(--color-accent-light); background: var(--color-accent-light); color: var(--color-accent); }
  .meta-row { display: flex; justify-content: space-between; align-items: center; font-size: var(--font-size-sm); }
  .meta-label { color: var(--color-text-secondary); }
  .meta-value { color: var(--color-text); }
  .delete-section { margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--color-separator); }
  .delete-trigger { width: 100%; padding: 0.75rem; border-radius: var(--radius-md); color: var(--color-danger); font-weight: 600; font-size: var(--font-size-base); }
  .confirm-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
  .cancel-btn { flex: 1; padding: 0.5rem; border-radius: var(--radius-md); font-size: var(--font-size-sm); color: var(--color-text-secondary); background: var(--color-bg-secondary); }
  .confirm-delete-btn { flex: 1; padding: 0.5rem; border-radius: var(--radius-md); background: var(--color-danger); color: var(--color-on-danger); font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm); }
</style>
