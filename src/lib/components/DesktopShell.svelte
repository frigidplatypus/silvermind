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
  import FloatingAddButton from './FloatingAddButton.svelte';
  import { triggerAddTask } from '$lib/stores/add-task.svelte';
  import Icon from './Icon.svelte';
  import { getSelectedTaskId, setSelectedTaskId } from '$lib/stores/desktop.svelte';
  import { getTasks, loadInbox, loadToday } from '$lib/stores/tasks.svelte';
  import { getCurrentQueryTasks, getCurrentQueryTitle, getQueryLoading, runQuery, clearQueryResults } from '$lib/stores/queries.svelte';
  import { markTaskDone, undoTask } from '$lib/api/tasks';
  import type { Task } from '$lib/types/task';
  import SearchBar from './SearchBar.svelte';
  import ServiceErrorBanner from './ServiceErrorBanner.svelte';
  import Toast from './Toast.svelte';
  import { showError, showSuccess } from '$lib/stores/toast.svelte';
  import { getResults, getQuery, getIsActive, getIsSearching, activateSearch, deactivateSearch } from '$lib/stores/search.svelte';
  import { setBuilderEdit } from '$lib/stores/builder-edit.svelte';
  import GlobalPage from '../../routes/global/+page.svelte';
  import BuilderPage from '../../routes/builder/+page.svelte';
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

  let sidebarWidth = $state(loadSidebarWidth());
  let sidebarDragging = $state(false);
  let sidebarDragStartX = 0;
  let sidebarDragStartWidth = 0;

  function loadSidebarWidth(): number {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('sidebar-width');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return Math.max(0, val);
      }
    }
    return 220;
  }

  function saveSidebarWidth(w: number) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sidebar-width', String(w));
    }
  }

  function maxSidebarWidth(): number {
    return Math.floor(window.innerWidth * 0.4);
  }

  function onSidebarDown(e: PointerEvent) {
    sidebarDragging = true;
    sidebarDragStartX = e.clientX;
    sidebarDragStartWidth = sidebarWidth;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onSidebarMove(e: PointerEvent) {
    if (!sidebarDragging) return;
    const dx = e.clientX - sidebarDragStartX;
    sidebarWidth = Math.max(0, Math.min(maxSidebarWidth(), sidebarDragStartWidth + dx));
  }

  function onSidebarUp() {
    sidebarDragging = false;
    saveSidebarWidth(sidebarWidth);
  }

  function onSidebarKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      sidebarWidth = Math.max(0, sidebarWidth - 20);
      saveSidebarWidth(sidebarWidth);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      sidebarWidth = Math.min(maxSidebarWidth(), sidebarWidth + 20);
      saveSidebarWidth(sidebarWidth);
    }
  }

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
    if (activeView === 'today') loadToday();
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

  function handleEditQuery() {
    const parts = activeView.split(':');
    const page = parts[1];
    const blockNumber = parts[2] ? parseInt(parts[2]) : 0;
    const title = queryTitle ?? '';
    setBuilderEdit(page, title, blockNumber);
    onNavigate('builder');
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

  const viewTitle = $derived(
    getIsActive() ? 'Search'
    : activeView === 'inbox' ? 'Task List'
    : activeView === 'today' ? 'Today'
    : activeView === 'global' ? 'All Tasks'
    : activeView === 'builder' ? 'New Query'
    : activeView === 'settings' ? 'Settings'
    : isQueryView ? (queryTitle ?? 'Query')
    : ''
  );

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
          triggerAddTask();
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
          }).catch((e2) => showError(`Done failed: ${e2.message}`));
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
          }).catch((e2) => showError(`Undo failed: ${e2.message}`));
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

<div class="desktop-shell" class:dragging-sidebar={sidebarDragging}>
  <Sidebar {activeView} {onNavigate} width={sidebarWidth} />
  <div
    class="sidebar-divider"
    role="separator"
    aria-label="Resize sidebar"
    aria-valuenow={sidebarWidth}
    aria-valuemin={0}
    aria-valuemax={maxSidebarWidth()}
    tabindex="0"
    onpointerdown={onSidebarDown}
    onpointermove={onSidebarMove}
    onpointerup={onSidebarUp}
    onkeydown={onSidebarKeydown}
  ></div>
  <div class="desktop-main">
    <ServiceErrorBanner />
    <div class="desktop-top-bar">
      <h2 class="top-bar-title">{viewTitle}</h2>
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
        <button class="query-edit-btn" onclick={handleEditQuery} aria-label="Edit query">
          <Icon name="edit-3" size="0.875rem" />
        </button>
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
          {:else if activeView === 'builder'}
            <BuilderPage />
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
  <FloatingAddButton />
</div>

<Toast />

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
  .desktop-shell.dragging-sidebar {
    user-select: none;
  }
  .sidebar-divider {
    width: 4px;
    background: var(--color-separator);
    cursor: col-resize;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .sidebar-divider:hover,
  .dragging-sidebar .sidebar-divider {
    background: var(--color-accent);
  }
  .desktop-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .desktop-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-separator);
  }
  .top-bar-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
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
  .query-edit-btn {
    margin-left: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }
  .query-edit-btn:hover {
    background: var(--color-bg-tertiary);
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
