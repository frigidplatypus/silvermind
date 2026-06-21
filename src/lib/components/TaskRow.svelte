<script lang="ts">
  import type { Task } from '$lib/types/task';
  import Icon from './Icon.svelte';
  import Markdown from './Markdown.svelte';
  import { getSelectedTaskId } from '$lib/stores/desktop.svelte';

  let { task, onclick, id, showSpace = false }: { task: Task; onclick?: (id: string) => void; id: string; showSpace?: boolean } = $props();

  let highlighted = $derived(getSelectedTaskId() === id);

  const priorityLabel = $derived(
    task.priority === 'high' ? 'High priority' : task.priority === 'medium' ? 'Medium priority' : task.priority === 'low' ? 'Low priority' : 'No priority',
  );

  const dueLabel = $derived.by(() => {
    if (!task.due_parsed?.date) return null;
    const d = new Date(task.due_parsed.date + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diff = d.getTime() - today.getTime();
    const days = Math.round(diff / 86400000);
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, class: 'overdue' };
    if (days === 0) return { text: 'Today', class: 'today' };
    if (days === 1) return { text: 'Tomorrow', class: 'upcoming' };
    return { text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), class: 'upcoming' };
  });

  function handleClick() {
    onclick?.(id);
  }
</script>

<button id="task-{id}" class="task-row" class:highlighted onclick={handleClick} aria-label="Task: {task.text}. {priorityLabel}. {dueLabel?.text ?? ''}">
  <div class="task-row-left">
    <div class="priority-dot" class:high={task.priority === 'high'} class:medium={task.priority === 'medium'} class:low={task.priority === 'low'}></div>
    {#if task.blocked}
      <span class="status-icon-block" title="Blocked by dependencies"><Icon name="lock" size="0.875rem" /></span>
    {/if}
    {#if task.recur}
      <span class="status-icon-recur" title="Recurring: {task.recur}"><Icon name="repeat" size="0.875rem" /></span>
    {/if}
    <div class="task-content">
      <span class="task-title" class:done={task.done}><Markdown text={task.text} inline={true} /></span>
    </div>
  </div>
  <div class="task-row-right">
    {#if dueLabel}
      <span class="task-due" class:overdue={dueLabel.class === 'overdue'} class:today={dueLabel.class === 'today'}>{dueLabel.text}</span>
    {/if}
    <span class="page-tag">{showSpace && (task as any)._spaceName ? (task as any)._spaceName : task.page}</span>
  </div>
</button>

<style>
  .task-row { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0.875rem 1rem; background: var(--color-surface); border-bottom: 0.5px solid var(--color-separator); text-align: left; gap: 0.75rem; }
  .task-row:active { background: var(--color-bg-tertiary); }
.task-row.highlighted { background: var(--color-bg-tertiary); outline: 2px solid var(--color-accent); outline-offset: -2px; }
  .task-row-left { display: flex; align-items: flex-start; gap: 0.625rem; flex: 1; min-width: 0; }
  .priority-dot { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: var(--color-priority-none); margin-top: 0.45rem; flex-shrink: 0; }
  .priority-dot.high { background: var(--color-priority-high); }
  .priority-dot.medium { background: var(--color-priority-medium); }
  .priority-dot.low { background: var(--color-accent); }
  .status-icon-block { color: var(--color-danger); margin-top: 0.25rem; flex-shrink: 0; }
  .status-icon-recur { color: var(--color-accent); margin-top: 0.25rem; flex-shrink: 0; }
  .task-content { display: flex; flex-direction: column; min-width: 0; }
  .task-title { font-size: var(--font-size-base); font-weight: 500; color: var(--color-text); line-height: 1.4; }
  .task-title.done { text-decoration: line-through; color: var(--color-text-tertiary); }
  .task-row-right { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .task-due { font-size: var(--font-size-xs); font-weight: 500; padding: 0.125rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-bg-tertiary); color: var(--color-text-secondary); white-space: nowrap; }
  .task-due.overdue { background: var(--color-danger-light); color: var(--color-danger); }
  .task-due.today { background: var(--color-warning-light); color: var(--color-warning); }
  .page-tag { font-size: var(--font-size-xs); color: var(--color-text-tertiary); }
</style>
