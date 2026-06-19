<script lang="ts">
  import { onMount } from 'svelte';
  import { loadInbox, getTasks, getTasksLoading } from '$lib/stores/tasks.svelte';
  import type { Task } from '$lib/types/task';
  import TaskList from '$lib/components/TaskList.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';

  let selectedTask = $state<Task | null>(null);

  onMount(() => { loadInbox(); });

  function handleDetailClose() { selectedTask = null; }
  function handleTaskChanged(_t: Task) { selectedTask = null; loadInbox(); }
</script>

<div class="inbox-view">
  <TaskList tasks={getTasks()} isLoading={getTasksLoading()} onTaskTap={(t) => (selectedTask = t)} onRefresh={loadInbox} emptyMessage="All tasks complete" />
  <TaskDetail task={selectedTask} onclose={handleDetailClose} ontaskchanged={handleTaskChanged} />
</div>

<style>
  .inbox-view { display: flex; flex-direction: column; height: 100%; }
</style>
