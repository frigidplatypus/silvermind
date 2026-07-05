<script lang="ts">
  import type { Task } from '$lib/types/task';
  import Icon from './Icon.svelte';
  import Markdown from './Markdown.svelte';
  import { getSelectedTaskId } from '$lib/stores/desktop.svelte';
  import { getActiveSpace } from '$lib/stores/space.svelte';

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
    onToggleDone?: (task: Task) => void | boolean | Promise<void | boolean>;
  } = $props();

  let highlighted = $derived(getSelectedTaskId() === id);
  let tagOverflowOpen = $state(false);
  let isToggling = $state(false);
  let verifiedComplete = $state(false);
  let hiddenAfterComplete = $state(false);
  const spaceURL = $derived(getActiveSpace()?.url ?? '');
  const displayText = $derived(
    (task?.text ?? '')
      .replace(/#[\w-]+(?:\/[\w-]+)*/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );

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

  async function handleToggle(e: Event) {
    e.stopPropagation();
    if (isToggling || verifiedComplete) return;
    const wasDone = task.done;
    isToggling = true;
    try {
      const result = await onToggleDone?.(task);
      if (result === false) return;
      if (!wasDone) {
        verifiedComplete = true;
        setTimeout(() => {
          hiddenAfterComplete = true;
        }, 950);
      }
    } finally {
      isToggling = false;
    }
  }
</script>

<button
  id="task-{id}"
  class="task-row"
  class:highlighted
  class:verified-complete={verifiedComplete}
  class:hidden-after-complete={hiddenAfterComplete}
  class:toggling={isToggling}
  onclick={handleClick}
  aria-label="Task: {task.text}. {priorityLabel}. {dueLabel?.text ?? ''}"
>
  <div class="task-row-left">
    <span
      class="task-checkbox"
      class:done={task.done || verifiedComplete}
      class:toggling={isToggling}
      onclick={handleToggle}
      role="checkbox"
      aria-checked={task.done || verifiedComplete}
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
    <div class="task-content">
      <span class="task-title" class:done={task.done || verifiedComplete}
        ><Markdown text={displayText} inline={true} {spaceURL} /></span
      >
      <span class="task-meta-bar">
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
        <span class="page-tag"
          >{showSpace ? ((task as any)._spaceName ?? task.page) : task.page}</span
        >
        {#if task.tags && task.tags.length > 0}
          {#each task.tags.slice(0, 2) as tag}
            <span class="tag-chip"><Icon name="tag" size="0.625rem" /> {tag}</span>
          {/each}
          {#if task.tags.length > 2}
            <span
              class="tag-overflow-wrapper"
              onmouseenter={() => (tagOverflowOpen = true)}
              onmouseleave={() => (tagOverflowOpen = false)}
            >
              <span class="tag-chip tag-overflow">+{task.tags.length - 2}</span>
              {#if tagOverflowOpen}
                <span class="tag-popover">
                  {#each task.tags.slice(2) as tag}
                    <span class="tag-popover-item"><Icon name="tag" size="0.625rem" /> {tag}</span>
                  {/each}
                </span>
              {/if}
            </span>
          {/if}
        {/if}
        <div
          class="priority-dot"
          class:high={task.priority === 'high'}
          class:medium={task.priority === 'medium'}
          class:low={task.priority === 'low'}
        ></div>
      </span>
    </div>
  </div>
</button>

<style>
  .task-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    width: 100%;
    padding: 0.875rem 1rem;
    background: var(--color-surface);
    border-bottom: 0.5px solid var(--color-separator);
    text-align: left;
    gap: 0.75rem;
    max-height: 12rem;
    overflow: hidden;
    opacity: 1;
    transform: translateX(0) scale(1);
    transition:
      background 0.2s ease,
      opacity 0.28s ease,
      transform 0.28s ease,
      max-height 0.32s ease,
      padding 0.32s ease,
      border-color 0.32s ease;
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
  .task-row.toggling {
    cursor: progress;
  }
  .task-row.verified-complete {
    background: var(--color-accent-light);
    animation: verified-complete-pulse 0.95s ease-in-out;
  }
  .task-row.hidden-after-complete {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    border-bottom-color: transparent;
    opacity: 0;
    transform: translateX(0.75rem) scale(0.985);
    pointer-events: none;
  }
  .task-row-left {
    display: flex;
    align-items: flex-start;
    gap: 0.625rem;
    flex: 1;
    min-width: 0;
  }
  .task-checkbox {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: 2px solid var(--color-separator);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 0.2rem;
    flex-shrink: 0;
    color: transparent;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
  }
  .task-checkbox.toggling {
    opacity: 0.65;
    animation: checkbox-pending 0.8s ease-in-out infinite;
  }
  .task-checkbox:active {
    background: var(--color-bg-tertiary);
  }
  .task-checkbox.done {
    background: var(--color-accent);
    border-color: var(--color-accent);
    color: var(--color-on-accent);
    animation: check-pop 0.35s ease;
  }
  .task-checkbox.done :global(svg) {
    animation: check-draw 0.3s ease 0.05s both;
  }
  @keyframes check-pop {
    0%   { transform: scale(1); }
    30%  { transform: scale(1.3); }
    60%  { transform: scale(0.9); }
    100% { transform: scale(1); }
  }
  @keyframes check-draw {
    0%   { transform: scale(0) rotate(-45deg); opacity: 0; }
    60%  { transform: scale(1.15) rotate(0deg); opacity: 1; }
    100% { transform: scale(1) rotate(0deg); opacity: 1; }
  }
  @keyframes checkbox-pending {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(0.88); }
  }
  @keyframes verified-complete-pulse {
    0% {
      background: var(--color-surface);
      box-shadow: inset 0 0 0 0 color-mix(in srgb, var(--color-accent) 0%, transparent);
    }
    35% {
      background: var(--color-accent-light);
      box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-accent) 28%, transparent);
    }
    70% {
      background: var(--color-accent-light);
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 16%, transparent);
    }
    100% {
      background: var(--color-surface);
      box-shadow: inset 0 0 0 0 transparent;
    }
  }
  .priority-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: var(--color-priority-none);
    margin-top: 0.45rem;
    flex-shrink: 0;
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
  .status-icon-block {
    color: var(--color-danger);
    margin-top: 0.25rem;
    flex-shrink: 0;
  }
  .status-icon-recur {
    color: var(--color-accent);
    margin-top: 0.25rem;
    flex-shrink: 0;
  }
  .task-content {
    flex: 1;
    min-width: 0;
    line-height: 1.4;
  }
  .task-title {
    font-size: var(--font-size-base);
    font-weight: 500;
    color: var(--color-text);
    word-break: break-word;
    overflow-wrap: break-word;
    hyphens: auto;
    transition: color 0.25s ease;
  }
  .task-title.done {
    text-decoration: line-through;
    color: var(--color-text-tertiary);
  }
  .task-meta-bar {
    float: right;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin-left: 0.5rem;
    margin-top: 0.125rem;
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
  }
  .tag-overflow {
    background: var(--color-accent-light);
    color: var(--color-accent);
    font-weight: 600;
  }
  .tag-overflow-wrapper {
    position: relative;
  }
  .tag-popover {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.25rem;
    z-index: 50;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px var(--color-shadow);
    min-width: 120px;
  }
  .tag-popover-item {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
    padding: 0.125rem 0;
  }

  @media (max-width: 500px) {
    .task-row {
      padding: 0.75rem 0.75rem;
      gap: 0.5rem;
    }
    .task-row-left {
      gap: 0.5rem;
    }
    .task-title {
      font-size: 0.9375rem;
    }
  }
</style>
