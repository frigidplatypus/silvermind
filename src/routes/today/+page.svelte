<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { loadToday, getTasksError } from '$lib/stores/tasks.svelte';
  import { getToday } from '$lib/api/today';
  import type { Task } from '$lib/types/task';
  import TaskRow from '$lib/components/TaskRow.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { onTaskTap: externalOnTaskTap }: { onTaskTap?: (t: Task) => void } = $props();

  let overdue = $state<Task[]>([]);
  let dueToday = $state<Task[]>([]);
  let scheduledToday = $state<Task[]>([]);
  let selectedTask = $state<Task | null>(null);

  let _pollTimer: ReturnType<typeof setInterval> | null = null;
  onMount(async () => {
    await refresh();
    _pollTimer = setInterval(async () => {
      try {
        const fresh = await getToday();
        const cur = { overdue, dueToday, scheduledToday };
        const cmp = { overdue: fresh.overdue, due_today: fresh.due_today, scheduled_today: fresh.scheduled_today };
        if (JSON.stringify(cmp) !== JSON.stringify(cur)) {
          overdue = fresh.overdue;
          dueToday = fresh.due_today;
          scheduledToday = fresh.scheduled_today;
        }
      } catch {
        /* silently ignore */
      }
    }, 30_000);
  });
  onDestroy(() => { if (_pollTimer) clearInterval(_pollTimer); });

  async function refresh() { const d = await loadToday(); overdue = d.overdue; dueToday = d.due_today; scheduledToday = d.scheduled_today; }

  function tid(t: Task) { return `${t.page}/${t.position}`; }

  function handleTaskTap(t: Task) {
    if (externalOnTaskTap) {
      externalOnTaskTap(t);
    } else {
      selectedTask = t;
    }
  }

  function handleDetailClose() { selectedTask = null; }
  function handleTaskChanged(_t: Task) { selectedTask = null; refresh(); }
</script>

<div class="today-page">
  {#if getTasksError()}
    <div class="error-state" role="alert">
      <Icon name="alert-triangle" size="1.25rem" />
      <p class="error-message">{getTasksError()}</p>
      <button class="retry-btn" onclick={refresh}>Retry</button>
    </div>
  {/if}
  <section><h2 class="heading overdue">Overdue</h2>
    {#each overdue as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => handleTaskTap(t)} />{/each}
    {#if overdue.length === 0}<p class="empty">No overdue tasks</p>{/if}
  </section>
  <section><h2 class="heading">Due Today</h2>
    {#each dueToday as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => handleTaskTap(t)} />{/each}
    {#if dueToday.length === 0}<p class="empty">No tasks due today</p>{/if}
  </section>
  <section><h2 class="heading">Scheduled Today</h2>
    {#each scheduledToday as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => handleTaskTap(t)} />{/each}
    {#if scheduledToday.length === 0}<p class="empty">No tasks scheduled for today</p>{/if}
  </section>
  {#if !externalOnTaskTap}
    <TaskDetail task={selectedTask} onclose={handleDetailClose} ontaskchanged={handleTaskChanged} />
  {/if}
</div>

<style>
  .today-page { overflow-y: auto; -webkit-overflow-scrolling: touch; background: var(--color-surface); }
  .heading { padding: 0.75rem 1rem 0.375rem; font-size: var(--font-size-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); background: var(--color-bg-secondary); }
  .heading.overdue { color: var(--color-danger); }
  .empty { padding: 0.75rem 1rem; color: var(--color-text-tertiary); font-size: var(--font-size-sm); }
  .error-state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2rem 1.5rem; text-align: center; color: var(--color-danger); }
  .error-message { font-size: var(--font-size-sm); line-height: 1.5; word-break: break-word; }
  .retry-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-danger); color: #fff; font-weight: 600; font-size: var(--font-size-sm); }
</style>
