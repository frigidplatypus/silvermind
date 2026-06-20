<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import SplitPane from './SplitPane.svelte';
  import TaskDetail from './TaskDetail.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import InboxPage from '../../routes/inbox/+page.svelte';
  import TodayPage from '../../routes/today/+page.svelte';
  import SettingsPage from '../../routes/settings/+page.svelte';
  import QuickCapture from './QuickCapture.svelte';
  import { getSelectedTaskId, setSelectedTaskId } from '$lib/stores/desktop.svelte';
  import { getTasks, loadInbox } from '$lib/stores/tasks.svelte';

  let {
    activeView,
    onNavigate,
  }: {
    activeView: string;
    onNavigate: (view: string) => void;
  } = $props();

  let prevView = $state(activeView);
  let editing = $state(false);

  $effect(() => {
    if (activeView !== prevView) {
      prevView = activeView;
      setSelectedTaskId(null);
    }
  });

  function handleTaskTap(task: any) {
    setSelectedTaskId(`${task.page}/${task.position}`);
  }

  function handleDetailClose() {
    setSelectedTaskId(null);
    loadInbox();
  }

  function handleTaskChanged() {
    setSelectedTaskId(null);
    loadInbox();
  }

  function handleEdit() {
    editing = true;
  }

  function handleEditSaved() {
    editing = false;
    setSelectedTaskId(null);
    loadInbox();
  }

  const selectedId = $derived(getSelectedTaskId());
  const allTasks = $derived(getTasks());
  const selectedTask = $derived(
    selectedId ? allTasks.find((t: any) => `${t.page}/${t.position}` === selectedId) ?? null : null,
  );
</script>

<div class="desktop-shell">
  <Sidebar activeView={activeView as 'inbox' | 'today' | 'settings'} {onNavigate} />
  <div class="desktop-main">
    <div class="desktop-top-bar">
      <QuickCapture />
    </div>
    <SplitPane showRight={!!selectedTask}>
      {#snippet left()}
        {#if activeView === 'inbox'}
          <InboxPage onTaskTap={handleTaskTap} />
        {:else if activeView === 'today'}
          <TodayPage onTaskTap={handleTaskTap} />
        {:else}
          <SettingsPage />
        {/if}
      {/snippet}
      {#snippet right()}
        {#if selectedTask}
          <TaskDetail task={selectedTask} variant="panel" onclose={handleDetailClose} ontaskchanged={handleTaskChanged} onedit={handleEdit} />
        {/if}
      {/snippet}
    </SplitPane>
  </div>
</div>

{#if editing && selectedTask}
  <TaskEditor task={selectedTask} mode="modal" onclose={() => (editing = false)} onsaved={handleEditSaved} />
{/if}

<style>
  .desktop-shell {
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }
  .desktop-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .desktop-top-bar {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid var(--color-separator);
  }
</style>
