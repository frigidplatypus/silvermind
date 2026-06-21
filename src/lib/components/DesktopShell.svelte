<script lang="ts">
  import { onMount } from 'svelte';
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
  import { markTaskDone, undoTask } from '$lib/api/tasks';
  import type { Task } from '$lib/types/task';
  import SearchBar from './SearchBar.svelte';
  import { getResults, getQuery, getIsActive, getIsSearching, activateSearch, deactivateSearch } from '$lib/stores/search.svelte';
  import GlobalPage from '../../routes/global/+page.svelte';
  import { getGlobalTasks, loadGlobalView } from '$lib/stores/global.svelte';

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
    if (activeView === 'global') loadGlobalView();
  }

  function handleQueryDetailClose() {
    setSelectedTaskId(null);
  }

  function handleQueryTaskChanged() {
    setSelectedTaskId(null);
    // Re-run the current query to refresh results
    if (activeView.startsWith('queries:')) {
      const parts = activeView.split(':');
      const page = parts[1];
      const index = parts[2] ? parseInt(parts[2]) : undefined;
      runQuery(page, index);
    }
  }

  function handleQueryTaskTap(task: any) {
    setSelectedTaskId(`${task.page}/${task.position}`);
  }

  function handleEdit() {
    editing = true;
  }

  function handleEditSaved() {
    editing = false;
    setSelectedTaskId(null);
    if (isQueryView) {
      handleQueryTaskChanged();
    } else {
      loadInbox();
    }
  }

  const selectedId = $derived(getSelectedTaskId());
  const allTasks = $derived(getTasks());
  const queryTasksList = $derived(getCurrentQueryTasks());
  const selectedTask = $derived.by(() => {
    if (!selectedId) return null;
    // Search inbox/today tasks first
    let found = allTasks.find((t: any) => `${t.page}/${t.position}` === selectedId);
    if (found) return found;
    // Fall back to query result tasks
    return queryTasksList.find((t: any) => `${t.page}/${t.position}` === selectedId) ?? null;
  });

  const isQueryView = $derived(activeView.startsWith('queries:'));
  const queryTitle = $derived(getCurrentQueryTitle());
  const queryTasks = $derived(getCurrentQueryTasks());
  const queryLoading = $derived(getQueryLoading());

  function isEditing(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
  }

  function getCurrentTasks(): Task[] {
    const searchActive = getIsActive();
    if (searchActive) return getResults();
    if (activeView === 'inbox') return allTasks;
    if (activeView === 'global') return getGlobalTasks();
    if (activeView.startsWith('queries:')) return queryTasksList;
    return [];
  }

  function handleSearchResultTap(t: Task) {
    setSelectedTaskId(`${t.page}/${t.position}`);
  }

  function scrollToTask(task: Task): void {
    const id = `task-${task.page}/${task.position}`;
    document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }

  onMount(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (isEditing()) return;

      switch (e.key) {
        case 'n': {
          e.preventDefault();
          document.getElementById('quick-input')?.focus();
          break;
        }
        case '/': {
          e.preventDefault();
          activateSearch(activeView === 'global' ? 'global' : 'active');
          setTimeout(() => document.getElementById('search-input')?.focus(), 0);
          break;
        }
        case 'j':
        case 'ArrowDown': {
          e.preventDefault();
          const tasks = getCurrentTasks();
          if (tasks.length === 0) return;
          const curId = getSelectedTaskId();
          const curIdx = curId ? tasks.findIndex((t) => `${t.page}/${t.position}` === curId) : -1;
          const nextIdx = Math.min(curIdx + 1, tasks.length - 1);
          if (nextIdx >= 0) {
            setSelectedTaskId(`${tasks[nextIdx].page}/${tasks[nextIdx].position}`);
            scrollToTask(tasks[nextIdx]);
          }
          break;
        }
        case 'k':
        case 'ArrowUp': {
          e.preventDefault();
          const tasks = getCurrentTasks();
          if (tasks.length === 0) return;
          const curId = getSelectedTaskId();
          const curIdx = curId ? tasks.findIndex((t) => `${t.page}/${t.position}` === curId) : 0;
          const prevIdx = Math.max(curIdx - 1, 0);
          if (prevIdx >= 0) {
            setSelectedTaskId(`${tasks[prevIdx].page}/${tasks[prevIdx].position}`);
            scrollToTask(tasks[prevIdx]);
          }
          break;
        }
        case 'e': {
          const id = getSelectedTaskId();
          if (!id) return;
          e.preventDefault();
          editing = true;
          break;
        }
        case 'd': {
          const id = getSelectedTaskId();
          if (!id) return;
          e.preventDefault();
          const [page, posStr] = id.split('/');
          const pos = parseInt(posStr);
          if (isNaN(pos)) return;
          markTaskDone(page, pos).then(() => {
            loadInbox();
            if (isQueryView) handleQueryTaskChanged();
          }).catch((e2) => alert(`Done failed: ${e2.message}`));
          break;
        }
        case 'u': {
          const id = getSelectedTaskId();
          if (!id) return;
          e.preventDefault();
          const [page, posStr] = id.split('/');
          const pos = parseInt(posStr);
          if (isNaN(pos)) return;
          undoTask(page, pos).then(() => {
            loadInbox();
            if (isQueryView) handleQueryTaskChanged();
          }).catch((e2) => alert(`Undo failed: ${e2.message}`));
          break;
        }
        case 'Escape': {
          setSelectedTaskId(null);
          (document.activeElement as HTMLElement)?.blur();
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="desktop-shell">
  <Sidebar {activeView} {onNavigate} />
  <div class="desktop-main">
    <div class="desktop-top-bar">
      <QuickCapture />
    </div>
    <SearchBar />
    {#if getIsActive()}
      <div class="search-results">
        {#if getQuery() && getResults().length === 0 && !getIsSearching()}
          <div class="search-empty">No results for &ldquo;{getQuery()}&rdquo;</div>
        {:else if getQuery() && getIsSearching()}
          <div class="search-status">Searching&hellip;</div>
        {:else if getResults().length > 0}
          <TaskList tasks={getResults()} onTaskTap={handleSearchResultTap} emptyMessage="No results" />
        {:else}
          <div class="search-empty">Type to search tasks</div>
        {/if}
      </div>
    {:else if isQueryView}
      <div class="query-header">
        <Icon name="search" size="1rem" />
        <span class="query-title">{queryTitle ?? 'Query'}</span>
      </div>
      <SplitPane showRight={!!selectedTask}>
        {#snippet left()}
          {#if queryLoading}
            <div class="query-loading">Running query…</div>
          {:else}
            <TaskList tasks={queryTasks} onTaskTap={handleQueryTaskTap} emptyMessage="No tasks found" />
          {/if}
        {/snippet}
        {#snippet right()}
          {#if selectedTask}
            <TaskDetail task={selectedTask} variant="panel" onclose={handleQueryDetailClose} ontaskchanged={handleQueryTaskChanged} onedit={handleEdit} />
          {/if}
        {/snippet}
      </SplitPane>
    {:else}
      <SplitPane showRight={!!selectedTask}>
        {#snippet left()}
          {#if activeView === 'inbox'}
            <InboxPage onTaskTap={handleTaskTap} />
          {:else if activeView === 'today'}
            <TodayPage onTaskTap={handleTaskTap} />
          {:else if activeView === 'global'}
            <GlobalPage onTaskTap={handleTaskTap} />
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
  .search-results {
    flex: 1;
    overflow-y: auto;
  }
  .search-empty, .search-status {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
</style>
