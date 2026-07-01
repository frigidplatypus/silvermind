<script lang="ts">
  import type { Task } from '$lib/types/task';
  import Icon from './Icon.svelte';
  import Markdown from './Markdown.svelte';
  import { getSelectedTaskId } from '$lib/stores/desktop.svelte';

  let {
    task,
    onclick,
    id,
    showSpace = false,
    onToggleDone,
  }: {
    task: Task;
    onclick?: (id: string) => void;
    id: string;
    showSpace?: boolean;
    onToggleDone?: (task: Task) => void;
  } = $props();

  let highlighted = $derived(getSelectedTaskId() === id);

  const priorityLabel = $derived(
    task.priority === 'high'
      ? 'High priority'
      : task.priority === 'medium'
        ? 'Medium priority'
        : task.priority === 'low'
          ? 'Low priority'
          : 'No priority',
  );

  const statusLabel = $derived.by(() => {
    if (task.done) return null;
    if (task.status === 'waiting') return { text: 'Waiting', cl: 'status-waiting' };
    if (task.status === 'maybe') return { text: 'Maybe', cl: 'status-maybe' };
    return null;
  });

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
    return {
      text: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      class: 'upcoming',
    };
  });

  function handleClick() {
    onclick?.(id);
  }

  function handleToggle(e: Event) {
    e.stopPropagation();
    onToggleDone?.(task);
  }
</script>

<button
  id="task-{id}"
  class="task-row"
  class:highlighted
  onclick={handleClick}
  aria-label="Task: {task.text}. {priorityLabel}. {dueLabel?.text ?? ''}"
>
  <span
    class="task-checkbox"
    class:done={task.done}
    onclick={handleToggle}
    role="checkbox"
    aria-checked={task.done}
    aria-label={task.done ? 'Mark task as active' : 'Mark task as done'}
    tabindex="0"
    onkeydown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleToggle(e as any);
      }
    }}
  >
    {#if task.done}
      <Icon name="check" size="0.75rem" />
    {/if}
  </span>

  <div class="task-body">
    <div class="task-title-row">
      {#if task.blocked}
        <span class="status-icon-block" role="img" aria-label="Blocked by dependencies"
          ><Icon name="lock" size="0.875rem" /></span
        >
      {/if}
      {#if task.recur}
        <span class="status-icon-recur" role="img" aria-label="Recurring: {task.recur}"
          ><Icon name="repeat" size="0.875rem" /></span
        >
      {/if}
      <span class="task-title" class:done={task.done}
        ><Markdown text={task.text} inline={true} /></span
      >
    </div>

    <div class="task-meta-row">
      {#if statusLabel}
        <span
          class="status-chip"
          class:status-waiting={statusLabel.cl === 'status-waiting'}
          class:status-maybe={statusLabel.cl === 'status-maybe'}>{statusLabel.text}</span
        >
      {/if}
      {#if dueLabel}
        <span
          class="task-due"
          class:overdue={dueLabel.class === 'overdue'}
          class:today={dueLabel.class === 'today'}>{dueLabel.text}</span
        >
      {/if}
      <span class="page-tag" title={showSpace ? ((task as any)._spaceName ?? task.page) : task.page}
        >{showSpace ? ((task as any)._spaceName ?? task.page) : task.page}</span
      >
      <div
        class="priority-dot"
        class:high={task.priority === 'high'}
        class:medium={task.priority === 'medium'}
        class:low={task.priority === 'low'}
      ></div>
    </div>

    {#if task.tags && task.tags.length > 0}
      <div class="task-tags-row">
        {#each task.tags as tag}
          <span class="tag-chip" title={tag}><Icon name="tag" size="0.625rem" /> {tag}</span>
        {/each}
      </div>
    {/if}
  </div>
</button>

<style>
  .task-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--color-surface);
    border-bottom: 0.5px solid var(--color-separator);
    text-align: left;
  }
  .task-row:active {
    background: var(--color-bg-tertiary);
  }
  .task-row:hover {
    background: var(--color-bg-secondary);
  }
  .task-row.highlighted {
    background: var(--color-bg-tertiary);
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }

  .task-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: 2px solid var(--color-separator);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 0.125rem;
    flex-shrink: 0;
    color: transparent;
    cursor: pointer;
  }
  .task-checkbox:active {
    background: var(--color-bg-tertiary);
  }
  .task-checkbox.done {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-on-accent);
  }

  .task-body {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .task-title-row {
    display: flex;
    align-items: flex-start;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .task-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text);
    line-height: 1.4;
    word-break: normal;
    overflow-wrap: break-word;
    hyphens: auto;
    flex: 1;
    min-width: 0;
  }
  .task-title.done {
    text-decoration: line-through;
    color: var(--color-text-tertiary);
  }

  .status-icon-block {
    color: var(--color-danger);
    margin-top: 0.2rem;
    flex-shrink: 0;
  }
  .status-icon-recur {
    color: var(--color-accent);
    margin-top: 0.2rem;
    flex-shrink: 0;
  }

  .task-meta-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .task-due {
    font-size: var(--font-size-xs);
    font-weight: 500;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .task-due.overdue {
    background: var(--color-danger-light);
    color: var(--color-danger);
  }
  .task-due.today {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }

  .status-chip {
    font-size: var(--font-size-xs);
    font-weight: 600;
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    white-space: nowrap;
  }
  .status-chip.status-waiting {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }
  .status-chip.status-maybe {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }

  .page-tag {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    min-width: 0;
  }

  .priority-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--color-priority-none);
    flex-shrink: 0;
    margin-top: 0.35rem;
  }
  .priority-dot.high {
    background: var(--color-priority-high);
  }
  .priority-dot.medium {
    background: var(--color-priority-medium);
  }
  .priority-dot.low {
    background: var(--color-priority-low);
  }

  .task-tags-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    flex-wrap: wrap;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.125rem;
    font-size: var(--font-size-2xs, 0.625rem);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Wider screens: keep metadata compact on a single row next to the title */
  @media (min-width: 640px) {
    .task-body {
      flex-direction: row;
      align-items: flex-start;
      gap: 0.75rem;
    }
    .task-title-row {
      flex: 1;
      flex-wrap: nowrap;
    }
    .task-meta-row {
      flex-shrink: 0;
      flex-wrap: nowrap;
      align-items: flex-start;
      margin-top: 0.125rem;
    }
    .task-tags-row {
      flex-shrink: 0;
      flex-wrap: nowrap;
      max-width: 12rem;
    }
    .page-tag {
      max-width: 8rem;
    }
  }
</style>
