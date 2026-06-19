<script lang="ts">
  import { onMount } from 'svelte';
  import { loadToday } from '$lib/stores/tasks.svelte';
  import type { Task } from '$lib/types/task';
  import TaskRow from '$lib/components/TaskRow.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';

  let overdue = $state<Task[]>([]);
  let dueToday = $state<Task[]>([]);
  let scheduledToday = $state<Task[]>([]);
  let selectedTask = $state<Task | null>(null);

  onMount(async () => { await refresh(); });
  async function refresh() { const d = await loadToday(); overdue = d.overdue; dueToday = d.due_today; scheduledToday = d.scheduled_today; }
  function tid(t: Task) { return `${t.page}/${t.position}`; }
  function handleDetailClose() { selectedTask = null; }
  function handleTaskChanged(_t: Task) { selectedTask = null; refresh(); }
</script>

<div class="today-page">
  <section><h2 class="heading overdue">Overdue</h2>
    {#each overdue as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => (selectedTask = t)} />{/each}
    {#if overdue.length === 0}<p class="empty">No overdue tasks</p>{/if}
  </section>
  <section><h2 class="heading">Due Today</h2>
    {#each dueToday as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => (selectedTask = t)} />{/each}
    {#if dueToday.length === 0}<p class="empty">No tasks due today</p>{/if}
  </section>
  <section><h2 class="heading">Scheduled Today</h2>
    {#each scheduledToday as t (tid(t))}<TaskRow task={t} id={tid(t)} onclick={() => (selectedTask = t)} />{/each}
    {#if scheduledToday.length === 0}<p class="empty">No tasks scheduled for today</p>{/if}
  </section>
  <TaskDetail task={selectedTask} onclose={handleDetailClose} ontaskchanged={handleTaskChanged} />
</div>

<style>
  .today-page { overflow-y: auto; -webkit-overflow-scrolling: touch; background: var(--color-surface); }
  .heading { padding: 0.75rem 1rem 0.375rem; font-size: var(--font-size-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--color-text-secondary); background: var(--color-bg-secondary); }
  .heading.overdue { color: var(--color-danger); }
  .empty { padding: 0.75rem 1rem; color: var(--color-text-tertiary); font-size: var(--font-size-sm); }
</style>
