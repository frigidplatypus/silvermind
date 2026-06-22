<script lang="ts">
  import type { Task } from '$lib/types/task';
  import TaskRow from './TaskRow.svelte';
  import Icon from './Icon.svelte';

  let {
    tasks,
    isLoading = false,
    error = null,
    onTaskTap,
    onRefresh,
    emptyMessage = 'No tasks',
  }: {
    tasks: Task[];
    isLoading?: boolean;
    error?: string | null;
    onTaskTap?: (task: Task) => void;
    onRefresh?: () => Promise<void>;
    emptyMessage?: string;
  } = $props();

  let isRefreshing = $state(false);
  let pullDistance = $state(0);
  let pullStartY = 0;
  let tracking = false;

  function onTouchStart(e: TouchEvent) {
    if (!onRefresh) return;
    const el = e.currentTarget as HTMLElement;
    if (el.scrollTop <= 0) {
      pullStartY = e.touches[0].clientY;
      tracking = true;
    }
  }

  function onTouchMove(e: TouchEvent) {
    if (!tracking) return;
    const dy = e.touches[0].clientY - pullStartY;
    pullDistance = Math.max(0, Math.min(dy, 80));
  }

  function onTouchEnd() {
    if (!tracking) return;
    tracking = false;
    if (pullDistance >= 60 && onRefresh) {
      isRefreshing = true;
      onRefresh().finally(() => { isRefreshing = false; });
    }
    pullDistance = 0;
  }

  function tid(t: Task) { return `${t.page}/${t.position}`; }
</script>

<div
  class="task-list-container"
  ontouchstart={onTouchStart}
  ontouchmove={onTouchMove}
  ontouchend={onTouchEnd}
>
  {#if isRefreshing}
    <div class="refresh-indicator">Refreshing…</div>
  {:else if pullDistance > 0}
    <div class="refresh-indicator" style="height:{pullDistance}px;opacity:{pullDistance/60}">Pull to refresh</div>
  {/if}

  {#if error}
    <div class="error-state" role="alert">
      <Icon name="alert-triangle" size="1.25rem" />
      <p class="error-message">{error}</p>
      {#if onRefresh}
        <button class="retry-btn" onclick={() => onRefresh()}>Retry</button>
      {/if}
    </div>
  {:else if isLoading}
    <div class="loading-state">Loading tasks…</div>
  {:else if tasks.length === 0}
    <div class="empty-state">{emptyMessage}</div>
  {:else}
    {#each tasks as task (tid(task))}
      <TaskRow {task} id={tid(task)} onclick={() => onTaskTap?.(task)} />
    {/each}
  {/if}
</div>

<style>
  .task-list-container { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .refresh-indicator { display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary); font-size: var(--font-size-sm); }
  .loading-state, .empty-state { display: flex; align-items: center; justify-content: center; padding: 3rem 1rem; color: var(--color-text-secondary); }
  .error-state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2rem 1.5rem; text-align: center; color: var(--color-danger); }
  .error-message { font-size: var(--font-size-sm); line-height: 1.5; word-break: break-word; max-width: 400px; }
  .retry-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-danger); color: #fff; font-weight: 600; font-size: var(--font-size-sm); }
</style>
