<script lang="ts">
  import type { Task } from '$lib/types/task';
  import Markdown from './Markdown.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import Icon from './Icon.svelte';
  import { markTaskDone, undoTask } from '$lib/api/tasks';
  import { notifySuccess } from '$lib/native/haptics';

  let { task, onclose, ontaskchanged, variant = 'overlay', onedit }: {
    task: Task | null;
    onclose: () => void;
    ontaskchanged?: (t: Task) => void;
    variant?: 'overlay' | 'panel';
    onedit?: () => void;
  } = $props();

  let editing = $state(false);

  async function toggleDone() {
    if (!task) return;
    try {
      const updated = task.done
        ? await undoTask(task.page, task.position)
        : await markTaskDone(task.page, task.position);
      notifySuccess();
      ontaskchanged?.(updated);
      onclose();
    } catch (e) {
      console.error('[silvermind] toggleDone failed:', e);
      alert(`Toggle done failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  const doneIcon = $derived(task?.done ? 'rotate-ccw' : 'check');
  const doneLabel = $derived(task?.done ? 'Undo' : 'Mark Done');
</script>

{#if task && !editing}
  {#if variant === 'panel'}
    <div class="panel" role="region" aria-label="Task details">
      <div class="panel-header">
        <button class="panel-close-btn" onclick={onclose} aria-label="Close"><Icon name="x" /></button>
        <button class="panel-edit-btn" onclick={() => onedit?.()} aria-label="Edit task"><Icon name="edit-3" /></button>
      </div>

      <div class="detail-body">
        <Markdown text={task.text} />
      </div>

      <div class="detail-meta">
        <div class="meta-row">
          <span class="meta-label">Page</span>
          <span class="meta-value">{task.page}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Position</span>
          <span class="meta-value">{task.position}</span>
        </div>
        {#if task.parent}
          <div class="meta-row">
            <span class="meta-label">Parent</span>
            <span class="meta-value">{task.parent}</span>
          </div>
        {/if}
        <div class="meta-row">
          <span class="meta-label">Priority</span>
          <span class="meta-value">{task.priority || 'none'}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Status</span>
          <span class="meta-value">{task.done ? 'Done' : 'Active'}</span>
        </div>
        {#if task.due_parsed?.date}
          <div class="meta-row">
            <span class="meta-label">Due</span>
            <span class="meta-value">{task.due_parsed.date}</span>
          </div>
        {/if}
        {#if task.scheduled_parsed?.date}
          <div class="meta-row">
            <span class="meta-label">Scheduled</span>
            <span class="meta-value">{task.scheduled_parsed.date}</span>
          </div>
        {/if}
        {#if task.tags.length > 0}
          <div class="meta-row">
            <span class="meta-label">Tags</span>
            <div class="tags">
              {#each task.tags as tag}
                <span class="tag">{tag}</span>
              {/each}
            </div>
          </div>
        {/if}
        {#if task.extra_attrs && Object.keys(task.extra_attrs).length > 0}
          {#each Object.entries(task.extra_attrs) as [key, val]}
            <div class="meta-row">
              <span class="meta-label">{key}</span>
              <span class="meta-value">{val}</span>
            </div>
          {/each}
        {/if}
      </div>

      <button class="done-btn" class:is-done={task.done} onclick={toggleDone} aria-label={doneLabel}>
        <Icon name={doneIcon} /> {doneLabel}
      </button>
    </div>
  {:else}
    <div class="overlay" onclick={onclose} role="dialog" aria-label="Task details">
      <div class="sheet" onclick={(e) => e.stopPropagation()} role="document">
        <button class="close-btn" onclick={onclose} aria-label="Close"><Icon name="x" /></button>
        <button class="edit-btn" onclick={() => (editing = true)} aria-label="Edit task"><Icon name="edit-3" /></button>

        <div class="detail-body">
          <Markdown text={task.text} />
        </div>

        <div class="detail-meta">
          <div class="meta-row">
            <span class="meta-label">Page</span>
            <span class="meta-value">{task.page}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Position</span>
            <span class="meta-value">{task.position}</span>
          </div>
          {#if task.parent}
            <div class="meta-row">
              <span class="meta-label">Parent</span>
              <span class="meta-value">{task.parent}</span>
            </div>
          {/if}
          <div class="meta-row">
            <span class="meta-label">Priority</span>
            <span class="meta-value">{task.priority || 'none'}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">Status</span>
            <span class="meta-value">{task.done ? 'Done' : 'Active'}</span>
          </div>
          {#if task.due_parsed?.date}
            <div class="meta-row">
              <span class="meta-label">Due</span>
              <span class="meta-value">{task.due_parsed.date}</span>
            </div>
          {/if}
          {#if task.scheduled_parsed?.date}
            <div class="meta-row">
              <span class="meta-label">Scheduled</span>
              <span class="meta-value">{task.scheduled_parsed.date}</span>
            </div>
          {/if}
          {#if task.tags.length > 0}
            <div class="meta-row">
              <span class="meta-label">Tags</span>
              <div class="tags">
                {#each task.tags as tag}
                  <span class="tag">{tag}</span>
                {/each}
              </div>
            </div>
          {/if}
          {#if task.extra_attrs && Object.keys(task.extra_attrs).length > 0}
            {#each Object.entries(task.extra_attrs) as [key, val]}
              <div class="meta-row">
                <span class="meta-label">{key}</span>
                <span class="meta-value">{val}</span>
              </div>
            {/each}
          {/if}
        </div>

        <button class="done-btn" class:is-done={task.done} onclick={toggleDone} aria-label={doneLabel}>
          <Icon name={doneIcon} /> {doneLabel}
        </button>
      </div>
    </div>
  {/if}
{/if}

{#if editing && task}
  <TaskEditor {task} onclose={() => (editing = false)} onsaved={(updated: Task) => { ontaskchanged?.(updated); editing = false; }} />
{/if}

<style>
  .overlay { position: fixed; inset: 0; z-index: 200; background: var(--color-overlay); display: flex; align-items: flex-end; justify-content: center; }
  .sheet { background: var(--color-surface); width: 100%; max-height: 85vh; overflow-y: auto; border-radius: var(--radius-xl) var(--radius-xl) 0 0; padding: 2.5rem 1rem 2rem; padding-bottom: max(2rem, var(--safe-area-bottom)); position: relative; }
  .close-btn { position: absolute; top: 0.75rem; right: 0.75rem; padding: 0.5rem; font-size: 1.125rem; color: var(--color-text-secondary); border-radius: var(--radius-md); width: 2.25rem; height: 2.25rem; display: flex; align-items: center; justify-content: center; }
  .edit-btn { position: absolute; top: 0.75rem; right: 3.25rem; padding: 0.5rem; font-size: 1.125rem; color: var(--color-accent); border-radius: var(--radius-md); width: 2.25rem; height: 2.25rem; display: flex; align-items: center; justify-content: center; }
  .panel { display: flex; flex-direction: column; height: 100%; padding: 1rem; overflow-y: auto; }
  .panel-header { display: flex; justify-content: flex-end; gap: 0.5rem; margin-bottom: 0.5rem; }
  .panel-close-btn, .panel-edit-btn { padding: 0.5rem; font-size: 1.125rem; border-radius: var(--radius-md); width: 2.25rem; height: 2.25rem; display: flex; align-items: center; justify-content: center; }
  .panel-close-btn { color: var(--color-text-secondary); }
  .panel-edit-btn { color: var(--color-accent); }
  .detail-body { margin: 0.5rem 0 1rem; font-size: var(--font-size-base); line-height: 1.6; }
  .done-btn { width: 100%; padding: 0.75rem; border-radius: var(--radius-md); font-weight: 600; font-size: var(--font-size-base); color: var(--color-success); background: var(--color-success-light); margin-top: 1rem; }
  .done-btn.is-done { color: var(--color-accent); background: var(--color-accent-light); }
  .detail-meta { display: flex; flex-direction: column; gap: 0.5rem; border-top: 1px solid var(--color-separator); padding-top: 1rem; }
  .meta-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; font-size: var(--font-size-sm); }
  .meta-label { color: var(--color-text-secondary); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; flex-shrink: 0; }
  .meta-value { color: var(--color-text); text-align: right; word-break: break-word; }
  .tags { display: flex; flex-wrap: wrap; gap: 0.25rem; justify-content: flex-end; }
  .tag { font-size: var(--font-size-xs); padding: 0.125rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
</style>
