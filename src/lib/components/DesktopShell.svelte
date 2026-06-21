<script lang="ts">
  import Sidebar from './Sidebar.svelte';
  import SplitPane from './SplitPane.svelte';
  import TaskDetail from './TaskDetail.svelte';
  import TaskEditor from './TaskEditor.svelte';
  import TaskList from './TaskList.svelte';
  import InboxPage from '../../routes/inbox/+page.svelte';
  import TodayPage from '../../routes/today/+page.svelte';
  import SettingsPage from '../../routes/settings/+page.svelte';
  import QuickCapture from './QuickCapture.svelte';
  import Icon from './Icon.svelte';
  import { getSelectedTaskId, setSelectedTaskId } from '$lib/stores/desktop.svelte';
  import { getTasks, loadInbox } from '$lib/stores/tasks.svelte';
  import { getCurrentQueryTasks, getCurrentQueryTitle, getQueryLoading, runQuery, clearQueryResults } from '$lib/stores/queries.svelte';

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
      if (activeView.startsWith('queries:')) {
        const parts = activeView.split(':');
        const page = parts[1];
        const index = parts[2] ? parseInt(parts[2]) : undefined;
        runQuery(page, index);
      } else {
        clearQueryResults();
      }
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

  const isQueryView = $derived(activeView.startsWith('queries:'));
  const queryTitle = $derived(getCurrentQueryTitle());
  const queryTasks = $derived(getCurrentQueryTasks());
  const queryLoading = $derived(getQueryLoading());
</script>

<div class="desktop-shell">
  <Sidebar {activeView} {onNavigate} />
  <div class="desktop-main">
    <div class="desktop-top-bar">
      <QuickCapture />
    </div>
    {#if isQueryView}
      <div class="query-view">
        <div class="query-header">
          <Icon name="search" size="1rem" />
          <span class="query-title">{queryTitle ?? 'Query'}</span>
        </div>
        {#if queryLoading}
          <div class="query-loading">Running query…</div>
        {:else}
          <TaskList tasks={queryTasks} emptyMessage="No tasks found" />
        {/if}
      </div>
    {:else}
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
    {/if}
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
  .query-view {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .query-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-separator);
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-accent);
  }
  .query-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .query-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
  }
</style>
