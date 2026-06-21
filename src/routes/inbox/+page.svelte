<script lang="ts">
  import { onMount } from 'svelte';
  import { loadInbox, getTasks, getTasksLoading, getTasksError } from '$lib/stores/tasks.svelte';
  import type { Task } from '$lib/types/task';
  import TaskList from '$lib/components/TaskList.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';

  let { onTaskTap: externalOnTaskTap }: { onTaskTap?: (t: Task) => void } = $props();

  let selectedTask = $state<Task | null>(null);

  onMount(() => { loadInbox(); });

  function handleTaskTap(t: Task) {
    if (externalOnTaskTap) {
      externalOnTaskTap(t);
    } else {
      selectedTask = t;
    }
  }

  function handleDetailClose() { selectedTask = null; }
  function handleTaskChanged(_t: Task) { selectedTask = null; loadInbox(); }
</script>

<div class="inbox-view">
  <TaskList tasks={getTasks()} isLoading={getTasksLoading()} error={getTasksError()} onTaskTap={handleTaskTap} onRefresh={async () => { loadInbox(); }} emptyMessage="All tasks complete" />
  {#if !externalOnTaskTap}
    <TaskDetail task={selectedTask} onclose={handleDetailClose} ontaskchanged={handleTaskChanged} />
  {/if}
</div>

<style>
  .inbox-view { display: flex; flex-direction: column; height: 100%; }
</style>
