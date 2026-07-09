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
  import { getTasks, loadInbox, loadToday, updateTaskInList } from '$lib/stores/tasks.svelte';
  import {
    getCurrentQueryTasks,
    getCurrentQueryTitle,
    getQueryLoading,
    runQuery,
    clearQueryResults,
    getErrorSLIQ,
    getQueryError,
    getQueryPagesList,
    getFavoriteQueries,
    loadQueryPages,
  } from '$lib/stores/queries.svelte';
  import { markTaskDone, undoTask } from '$lib/api/tasks';
  import { getQueryBlocks, toggleQueryFavorite, isQueryFavorite } from '$lib/api/queries';
  import type { Task } from '$lib/types/task';
  import SearchBar from './SearchBar.svelte';
  import ServiceErrorBanner from './ServiceErrorBanner.svelte';
  import Toast from './Toast.svelte';
  import KeyboardShortcuts from './KeyboardShortcuts.svelte';
  import PrivacyConsent from './PrivacyConsent.svelte';
  import { showError, showSuccess } from '$lib/stores/toast.svelte';
  import { toggleTaskDone } from '$lib/helpers/task-actions';
  import { logInfo } from '$lib/helpers/logger';
  import {
    getResults,
    getQuery,
    getIsActive,
    getIsSearching,
    activateSearch,
    deactivateSearch,
  } from '$lib/stores/search.svelte';
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

  let prevView = $state('');
  let editing = $state(false);
  let showShortcuts = $state(false);
  let consentRef: { show(): void } | undefined = $state();

  let sidebarWidth = $state(loadSidebarWidth());
  let sidebarCollapsed = $state(false);
  let lastSidebarWidth = loadSidebarWidth() || 220;
  let sidebarDragging = $state(false);
  let sidebarDragStartX = 0;
  let sidebarDragStartWidth = 0;

  $effect(() => {
    sidebarCollapsed = sidebarWidth === 0;
  });

  function toggleSidebar() {
    if (sidebarCollapsed) {
      sidebarWidth = lastSidebarWidth || 220;
      sidebarCollapsed = false;
      saveSidebarWidth(sidebarWidth);
    } else {
      lastSidebarWidth = sidebarWidth > 0 ? sidebarWidth : lastSidebarWidth;
      sidebarWidth = 0;
      sidebarCollapsed = true;
    }
  }

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

  function taskId(task: Task): string {
    return `${task._spaceUrl ?? task._spaceName ?? 'active'}/${task.page}/${task.position}`;
  }

  function decodeQueryPage(page: string): string {
    try {
      return decodeURIComponent(page);
    } catch {
      return page;
    }
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
        const page = decodeQueryPage(parts[1]);
        const index = parts[2] ? parseInt(parts[2]) : undefined;
        runQuery(page, index);
      } else {
        clearQueryResults();
      }
    }
  });

  function handleTaskTap(task: any) {
    setSelectedTaskId(taskId(task));
  }

  function handleToggleDone(task: Task) {
    return toggleTaskDone(task, () => {
      loadInbox();
      if (activeView === 'today') loadToday();
      if (isQueryView) handleQueryTaskChanged();
      if (activeView === 'global') loadGlobalView();
    });
  }

  function handleDetailClose() {
    setSelectedTaskId(null);
    loadInbox();
  }

  function handleTaskChanged(updated: Task | undefined) {
    setSelectedTaskId(null);
    if (updated) updateTaskInList(updated);
    // Still refresh in background to catch up with any indexing delay
    setTimeout(() => {
      loadInbox();
      if (activeView === 'today') loadToday();
      if (activeView === 'global') loadGlobalView();
    }, 1000);
  }

  function handleQueryDetailClose() {
    setSelectedTaskId(null);
  }

  function handleQueryTaskChanged() {
    setSelectedTaskId(null);
    // Re-run the current query to refresh results
    if (activeView.startsWith('queries:')) {
      const parts = activeView.split(':');
      const page = decodeQueryPage(parts[1]);
      const index = parts[2] ? parseInt(parts[2]) : undefined;
      runQuery(page, index);
    }
  }

  function handleQueryTaskTap(task: any) {
    setSelectedTaskId(taskId(task));
  }

  async function handleEditQuery() {
    if (!activeView.startsWith('queries:')) return;
    const parts = activeView.split(':');
    const page = decodeQueryPage(parts[1]);
    const blockIndex = parts[2] ? parseInt(parts[2]) : undefined;
    const blocks = await getQueryBlocks(page);
    const block = blockIndex ? blocks.find((b) => b.number === blockIndex) : blocks[0];
    if (!block) return;
    setBuilderEdit(page, block.title, block.number, block.sliq);
    onNavigate('builder');
  }

  const currentQueryPage = $derived(
    activeView.startsWith('queries:') ? decodeQueryPage(activeView.split(':')[1]) : '',
  );
  const currentQueryBlockNumber = $derived(
    activeView.startsWith('queries:') && activeView.split(':')[2]
      ? parseInt(activeView.split(':')[2])
      : 1,
  );
  const currentQueryHeading = $derived(
    (() => {
      const qp = getQueryPagesList().find((p) => p.page === currentQueryPage);
      if (!qp) return '';
      const block = qp.blocks.find((b) => b.number === currentQueryBlockNumber);
      return block?.title ?? qp.blocks[0]?.title ?? '';
    })(),
  );

  async function handleToggleQueryStar() {
    if (!currentQueryPage || !currentQueryHeading) return;
    await toggleQueryFavorite(currentQueryPage, currentQueryHeading, currentQueryBlockNumber);
    loadQueryPages(true);
  }

  function handleEdit() {
    editing = true;
  }

  function handleEditSaved(updated: Task | undefined) {
    editing = false;
    setSelectedTaskId(null);
    if (isQueryView) {
      handleQueryTaskChanged();
    } else {
      if (updated) updateTaskInList(updated);
      setTimeout(() => loadInbox(), 1000);
    }
  }

  const isQueryView = $derived(activeView.startsWith('queries:'));
  const queryTitle = $derived(getCurrentQueryTitle());
  const queryTasks = $derived(getCurrentQueryTasks());
  const selectedId = $derived(getSelectedTaskId());
  const allTasks = $derived(getTasks());
  const queryTasksList = $derived(getCurrentQueryTasks());
  const selectedTask = $derived.by(() => {
    if (!selectedId) return null;
    // When in a query view, prefer the query results (fresher data)
    if (isQueryView) {
      const found = queryTasksList.find((t: any) => taskId(t) === selectedId);
      if (found) return found;
    }
    if (getIsActive()) {
      const found = getResults().find((t: any) => taskId(t) === selectedId);
      if (found) return found;
    }
    if (activeView === 'global') {
      const found = getGlobalTasks().find((t: any) => taskId(t) === selectedId);
      if (found) return found;
    }
    return allTasks.find((t: any) => taskId(t) === selectedId) ?? null;
  });
  const queryLoading = $derived(getQueryLoading());
  const queryError = $derived(getQueryError());

  const viewTitle = $derived(
    getIsActive()
      ? 'Search'
      : activeView === 'inbox'
        ? 'Task List'
        : activeView === 'today'
          ? 'Today'
          : activeView === 'global'
            ? 'All Tasks'
            : activeView === 'builder'
              ? 'New Query'
              : activeView === 'settings'
                ? 'Settings'
                : isQueryView
                  ? (queryTitle ?? 'Query')
                  : '',
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
    setSelectedTaskId(taskId(t));
  }

  function scrollToTask(task: Task): void {
    const id = `task-${taskId(task)}`;
    document.getElementById(id)?.scrollIntoView({ block: 'nearest' });
  }

  onMount(() => {
    logInfo(`[desktop-shell] onMount — activeView=${activeView} width=${sidebarWidth}`);
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
          const curIdx = curId ? tasks.findIndex((t) => taskId(t) === curId) : -1;
          const nextIdx = Math.min(curIdx + 1, tasks.length - 1);
          if (nextIdx >= 0) {
            setSelectedTaskId(taskId(tasks[nextIdx]));
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
          const curIdx = curId ? tasks.findIndex((t) => taskId(t) === curId) : 0;
          const prevIdx = Math.max(curIdx - 1, 0);
          if (prevIdx >= 0) {
            setSelectedTaskId(taskId(tasks[prevIdx]));
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
          if (!selectedTask) return;
          e.preventDefault();
          markTaskDone(selectedTask)
            .then(() => {
              loadInbox();
              if (isQueryView) handleQueryTaskChanged();
            })
            .catch((e2) => showError(`Done failed: ${e2.message}`));
          break;
        }
        case 'u': {
          if (!selectedTask) return;
          e.preventDefault();
          undoTask(selectedTask)
            .then(() => {
              loadInbox();
              if (isQueryView) handleQueryTaskChanged();
            })
            .catch((e2) => showError(`Undo failed: ${e2.message}`));
          break;
        }
        case 'Escape': {
          setSelectedTaskId(null);
          (document.activeElement as HTMLElement)?.blur();
          break;
        }
        case '?': {
          e.preventDefault();
          showShortcuts = !showShortcuts;
          break;
        }
      }
    }

    document.addEventListener('keydown', handleKeydown);
    setTimeout(() => consentRef?.show(), 2000);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
</script>

<div class="desktop-shell" class:dragging-sidebar={sidebarDragging}>
  <Sidebar {activeView} {onNavigate} width={sidebarWidth} onToggleCollapse={toggleSidebar} />
  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
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
      {#if sidebarCollapsed}
        <button class="hamburger-btn" onclick={toggleSidebar} aria-label="Open sidebar">
          <Icon name="menu" size="1.25rem" />
        </button>
      {/if}
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
          <TaskList
            tasks={getResults()}
            onTaskTap={handleSearchResultTap}
            onToggleDone={handleToggleDone}
            emptyMessage="No results"
            showSpace
          />
        {:else}
          <div class="search-empty">Type to search tasks</div>
        {/if}
      </div>
    {:else if isQueryView}
      <div class="query-header">
        <Icon name="search" size="1rem" />
        <span class="query-title">{queryTitle ?? 'Query'}</span>
        {#if currentQueryHeading}
          <button
            class="query-star-btn"
            class:star-filled={isQueryFavorite(currentQueryPage, currentQueryHeading)}
            onclick={handleToggleQueryStar}
            aria-label={isQueryFavorite(currentQueryPage, currentQueryHeading)
              ? 'Remove from favorites'
              : 'Add to favorites'}
          >
            <Icon name="star" size="0.875rem" />
          </button>
        {/if}
        <button class="query-edit-btn" onclick={handleEditQuery} aria-label="Edit query">
          <Icon name="edit-3" size="0.875rem" />
        </button>
      </div>
      <SplitPane showRight={!!selectedTask}>
        {#snippet left()}
          {#if queryLoading}
            <div class="query-loading">Running query…</div>
          {:else if queryError}
            <div class="query-error">
              <Icon name="alert-triangle" size="1rem" />
              <span class="query-error-text">{queryError}</span>
              <button class="query-fix-btn" onclick={handleEditQuery}>
                <Icon name="edit-3" size="0.875rem" /> Fix Query
              </button>
            </div>
          {:else}
            <TaskList
              tasks={queryTasks}
              onTaskTap={handleQueryTaskTap}
              onToggleDone={handleToggleDone}
              emptyMessage="No tasks found"
              showSpace
            />
          {/if}
        {/snippet}
        {#snippet right()}
          {#if selectedTask}
            <TaskDetail
              task={selectedTask}
              variant="panel"
              onclose={handleQueryDetailClose}
              ontaskchanged={handleQueryTaskChanged}
              onedit={handleEdit}
            />
          {/if}
        {/snippet}
      </SplitPane>
    {:else}
      <SplitPane showRight={!!selectedTask}>
        {#snippet left()}
          {#if activeView === 'inbox'}
            <InboxPage onTaskTap={handleTaskTap} onToggleDone={handleToggleDone} />
          {:else if activeView === 'today'}
            <TodayPage onTaskTap={handleTaskTap} onToggleDone={handleToggleDone} />
          {:else if activeView === 'global'}
            <GlobalPage onTaskTap={handleTaskTap} onToggleDone={handleToggleDone} />
          {:else if activeView === 'builder'}
            <BuilderPage {onNavigate} />
          {:else}
            <SettingsPage />
          {/if}
        {/snippet}
        {#snippet right()}
          {#if selectedTask}
            <TaskDetail
              task={selectedTask}
              variant="panel"
              onclose={handleDetailClose}
              ontaskchanged={handleTaskChanged}
              onedit={handleEdit}
            />
          {/if}
        {/snippet}
      </SplitPane>
    {/if}
  </div>
  <FloatingAddButton />
</div>

<Toast />

{#if showShortcuts}
  <KeyboardShortcuts platform="desktop" onclose={() => (showShortcuts = false)} />
{/if}

<PrivacyConsent bind:this={consentRef} />

{#if editing && selectedTask}
  <TaskEditor
    task={selectedTask}
    mode="modal"
    onclose={() => (editing = false)}
    onsaved={handleEditSaved}
  />
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
  .hamburger-btn {
    background: none;
    border: none;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 0.5rem;
  }
  .hamburger-btn:hover {
    background: var(--color-bg-secondary);
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
  .query-star-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: var(--radius-md);
    color: var(--color-text-tertiary);
    flex-shrink: 0;
    background: none;
    border: none;
    cursor: pointer;
  }
  .query-star-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-accent);
  }
  .query-star-btn.star-filled {
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
  .query-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 2rem 1.5rem;
    margin: 1rem;
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-danger);
    border-radius: var(--radius-lg);
    color: var(--color-danger);
    text-align: center;
  }
  .query-error-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    max-width: 32rem;
    line-height: 1.5;
  }
  .query-fix-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-accent);
    background: var(--color-accent-light);
    border-radius: var(--radius-md);
  }
  .query-fix-btn:hover {
    background: var(--color-accent);
    color: var(--color-bg);
  }
  .search-results {
    flex: 1;
    overflow-y: auto;
  }
  .search-empty,
  .search-status {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
</style>
