<script lang="ts">
  import { onMount } from 'svelte';
  import { loadGlobalView, getGlobalTasks, getGlobalLoading, getGlobalError } from '$lib/stores/global.svelte';
  import type { Task } from '$lib/types/task';
  import TaskRow from '$lib/components/TaskRow.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { onTaskTap: externalOnTaskTap }: { onTaskTap?: (t: Task) => void } = $props();

  let selectedTask = $state<Task | null>(null);
  let tasks = $derived(getGlobalTasks());

  onMount(() => { loadGlobalView(); });

  function handleTaskTap(t: Task) {
    if (externalOnTaskTap) {
      externalOnTaskTap(t);
    } else {
      selectedTask = t;
    }
  }

  function handleDetailClose() { selectedTask = null; }
  function handleTaskChanged(_t: Task) { selectedTask = null; loadGlobalView(); }

  function tid(t: Task) { return `${t.page}/${t.position}`; }
</script>

<div class="global-view">
  {#if getGlobalLoading() && tasks.length === 0}
    <div class="global-status">Loading all spaces…</div>
  {:else if getGlobalError()}
    <div class="error-state" role="alert">
      <Icon name="alert-triangle" size="1.25rem" />
      <p class="error-message">{getGlobalError()}</p>
      <button class="retry-btn" onclick={() => loadGlobalView()}>Retry</button>
    </div>
  {:else if tasks.length === 0}
    <div class="global-status">No tasks across any space</div>
  {:else}
    {#each tasks as t (tid(t))}
      <TaskRow task={t} id={tid(t)} showSpace={true} onclick={() => handleTaskTap(t)} />
    {/each}
  {/if}
</div>

{#if !externalOnTaskTap}
  <TaskDetail task={selectedTask} onclose={handleDetailClose} ontaskchanged={handleTaskChanged} />
{/if}

<style>
  .global-view { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .global-status { display: flex; align-items: center; justify-content: center; padding: 3rem 1rem; color: var(--color-text-secondary); font-size: var(--font-size-sm); }
  .error-state { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2rem 1.5rem; text-align: center; color: var(--color-danger); }
  .error-message { font-size: var(--font-size-sm); line-height: 1.5; word-break: break-word; }
  .retry-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-danger); color: #fff; font-weight: 600; font-size: var(--font-size-sm); }
</style>
