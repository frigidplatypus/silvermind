<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { loadToday, getTasksError, getTasksLoading, getTodayOverdue, getTodayDue, getTodayDeferred } from '$lib/stores/tasks.svelte';
  import type { Task } from '$lib/types/task';
  import TaskRow from '$lib/components/TaskRow.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { toggleTaskDone } from '$lib/helpers/task-actions';

  let { onTaskTap: externalOnTaskTap, onToggleDone }: { onTaskTap?: (t: Task) => void; onToggleDone?: (t: Task) => void } = $props();

  let selectedTask = $state<Task | null>(null);
  let handleToggle = onToggleDone ?? ((task: Task) => toggleTaskDone(task, () => loadToday()));

  let _pollTimer: ReturnType<typeof setInterval> | null = null;
  onMount(async () => {
    await loadToday();
    _pollTimer = setInterval(() => { loadToday(); }, 30_000);
  });
  onDestroy(() => { if (_pollTimer) clearInterval(_pollTimer); });

  const overdue = $derived(getTodayOverdue());
  const dueToday = $derived(getTodayDue());
  const deferredToday = $derived(getTodayDeferred());

  function tid(t: Task) { return `${t.page}/${t.position}`; }

  function handleTaskTap(t: Task) {
    if (externalOnTaskTap) {
      externalOnTaskTap(t);
    } else {
      selectedTask = t;
    }
  }

  function handleDetailClose() { selectedTask = null; }
  function handleTaskChanged(_t: Task) { selectedTask = null; loadToday(); }
</script>

<div class="today-page">
  {#if getTasksLoading() && overdue.length === 0 && dueToday.length === 0 && deferredToday.length === 0}
    <div class="loading-state">Loading today's tasks…</div>
  {:else if getTasksError() && overdue.length === 0 && dueToday.length === 0 && deferredToday.length === 0}
    <div class="error-state" role="alert">
      <Icon name="alert-triangle" size="1.25rem" />
      <p class="error-message">{getTasksError()}</p>
      <button class="retry-btn" onclick={() => loadToday()}>Retry</button>
    </div>
  {:else}
    {#if getTasksError()}
      <div class="error-banner-inline" role="alert">
        <Icon name="alert-triangle" size="0.875rem" />
        <span>{getTasksError()}</span>
        <button class="retry-btn-inline" onclick={() => loadToday()}>Retry</button>
      </div>
    {/if}
    <section><h2 class="heading overdue">Overdue</h2>
      {#each overdue as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => handleTaskTap(t)} onToggleDone={handleToggle} />{/each}
      {#if overdue.length === 0}<p class="empty">No overdue tasks</p>{/if}
    </section>
    <section><h2 class="heading">Due Today</h2>
      {#each dueToday as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => handleTaskTap(t)} onToggleDone={handleToggle} />{/each}
      {#if dueToday.length === 0}<p class="empty">No tasks due today</p>{/if}
    </section>
    <section><h2 class="heading">Deferred Today</h2>
      {#each deferredToday as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => handleTaskTap(t)} onToggleDone={handleToggle} />{/each}
      {#if deferredToday.length === 0}<p class="empty">No tasks deferred for today</p>{/if}
    </section>
  {/if}
  {#if !externalOnTaskTap}
    <TaskDetail task={selectedTask} onclose={handleDetailClose} ontaskchanged={handleTaskChanged} />
  {/if}
</div>

<style>
  .today-page { overflow-y: auto; -webkit-overflow-scrolling: touch; background: var(--color-surface); }
  .heading { padding: var(--space-3) var(--space-4) 0.375rem; font-size: var(--font-size-sm); font-weight: var(--font-weight-semibold); text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); background: var(--color-bg-secondary); }
  .heading.overdue { color: var(--color-danger); }
  .empty { padding: var(--space-3) var(--space-4); color: var(--color-text-tertiary); font-size: var(--font-size-sm); }
  .loading-state { display: flex; align-items: center; justify-content: center; padding: 3rem var(--space-4); color: var(--color-text-secondary); font-size: var(--font-size-sm); }
  .error-state { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); padding: 2rem 1.5rem; text-align: center; color: var(--color-danger); }
  .error-message { font-size: var(--font-size-sm); line-height: var(--line-height-normal); word-break: break-word; }
  .retry-btn { padding: var(--space-2) var(--space-4); border-radius: var(--radius-md); background: var(--color-danger); color: var(--color-on-danger); font-weight: var(--font-weight-semibold); font-size: var(--font-size-sm); }
  .error-banner-inline { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-danger-light); color: var(--color-danger); font-size: var(--font-size-sm); }
  .retry-btn-inline { margin-left: auto; padding: 0.125rem var(--space-2); border-radius: var(--radius-sm); background: var(--color-danger); color: var(--color-on-danger); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); }
</style>
