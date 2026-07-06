<script lang="ts">
  import { onMount } from 'svelte';
  import { getServiceState, initServiceListener } from '$lib/stores/service.svelte';
  import { getActiveId } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { toggleTaskDone } from '$lib/helpers/task-actions';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { loadTagNames } from '$lib/stores/tagnames.svelte';
  import { getIsDesktop, setDesktopMode } from '$lib/stores/desktop.svelte';
  import { hideSplash } from '$lib/native/splash';
  import { setDarkStyle } from '$lib/native/status-bar';
  import FloatingAddButton from '$lib/components/FloatingAddButton.svelte';
  import { triggerAddTask } from '$lib/stores/add-task.svelte';
  import SpaceSwitcher from '$lib/components/SpaceSwitcher.svelte';
  import ServiceErrorBanner from '$lib/components/ServiceErrorBanner.svelte';
  import DesktopShell from '$lib/components/DesktopShell.svelte';
  import OnboardingModal from '$lib/components/OnboardingModal.svelte';
  import { getShowOnboarding } from '$lib/stores/onboarding.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { logInfo, logDebug } from '$lib/helpers/logger';
  import InboxPage from './inbox/+page.svelte';
  import TodayPage from './today/+page.svelte';
  import GlobalPage from './global/+page.svelte';
  import BuilderPage from './builder/+page.svelte';
  import SettingsPage from './settings/+page.svelte';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import TaskList from '$lib/components/TaskList.svelte';
  import TaskDetail from '$lib/components/TaskDetail.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import PrivacyConsent from '$lib/components/PrivacyConsent.svelte';
  import { getResults, getQuery, getIsActive, getIsSearching, activateSearch, deactivateSearch } from '$lib/stores/search.svelte';
  import { getDefaultView, getShowToday, loadShowToday } from '$lib/stores/landing.svelte';
  import type { Task } from '$lib/types/task';
  import QueriesPage from './queries/+page.svelte';
  import { getCurrentQueryTasks, getCurrentQueryTitle, getQueryLoading, getQueryError, runQuery, clearQueryResults, loadQueryPages } from '$lib/stores/queries.svelte';
  import { devLog } from '$lib/helpers/dev-log';

  let { activeTab = getDefaultView() }: { activeTab?: string } = $props();
  let currentTab = $state<string>(activeTab);
  let prevTab = $state<string>('inbox');
  let searchSelectedTask = $state<Task | null>(null);
  let querySelectedTask = $state<Task | null>(null);
  let showShortcuts = $state(false);
  let consentRef: { show(): void } | undefined = $state();

  function isEditing(): boolean {
    const el = document.activeElement;
    if (!el) return false;
    const tag = (el as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if ((el as HTMLElement).isContentEditable) return true;
    return false;
  }

  function handleGlobalKeydown(e: KeyboardEvent) {
    if (isEditing()) return;
    switch (e.key) {
      case 'n': {
        e.preventDefault();
        triggerAddTask();
        break;
      }
      case '/': {
        e.preventDefault();
        activateSearch(currentTab === 'global' ? 'global' : 'active');
        setTimeout(() => document.getElementById('search-input')?.focus(), 0);
        break;
      }
      case 'Escape': {
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

  $effect(() => { document.addEventListener('keydown', handleGlobalKeydown); return () => document.removeEventListener('keydown', handleGlobalKeydown); });

  $effect(() => {
    function check() { setDesktopMode(window.innerWidth >= 800); }
    check();
    logInfo(`[layout] initial isDesktop check: width=${window.innerWidth} desktop=${getIsDesktop()}`);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

  $effect(() => {
    setDarkStyle().catch(() => {});
    if (getServiceState().state === 'running' || getServiceState().state === 'failed') {
      hideSplash().catch(() => {});
    }
  });

  $effect(() => {
    function handleLinkClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      const link = target.closest('a');
      if (!link || !link.href) return;
      if (link.protocol === 'http:' || link.protocol === 'https:') {
        if (!link.href.startsWith('http://127.0.0.1') && !link.href.startsWith('http://localhost')) {
          e.preventDefault();
          const goApp = (window as any).go?.main?.App;
          if (goApp?.OpenURL) {
            goApp.OpenURL(link.href);
          } else {
            const wailsRuntime = (window as any).runtime;
            if (wailsRuntime?.BrowserOpenURL) {
              wailsRuntime.BrowserOpenURL(link.href);
            } else {
              const Browser = (window as any).Capacitor?.Plugins?.Browser;
              if (Browser?.open) {
                Browser.open({ url: link.href });
              } else {
                window.open(link.href, '_blank');
              }
            }
          }
        }
      }
    }
    document.addEventListener('click', handleLinkClick);
    return () => document.removeEventListener('click', handleLinkClick);
  });

  $effect(() => {
    const spaceId = getActiveId();
    if (spaceId) { loadInbox(); loadTaskNames(); loadTagNames(); }
  });

  $effect(() => {
    if (currentTab.startsWith('queries:')) {
      const parts = currentTab.slice(8).split(':');
      const page = parts[0];
      const index = parts[1] ? parseInt(parts[1]) : undefined;
      querySelectedTask = null;
      clearQueryResults();
      runQuery(page, index);
    }
  });

  $effect(() => {
    if (currentTab === 'queries') {
      loadQueryPages();
    }
  });

  onMount(() => {
    logInfo(`[layout] onMount — isDesktop=${getIsDesktop()} tab=${currentTab}`);
    initServiceListener();
    // Show privacy consent after splash fades, before onboarding
    setTimeout(() => consentRef?.show(), 2000);
  });

  function handleSearchClick() {
    activateSearch(currentTab === 'global' ? 'global' : 'active');
    setTimeout(() => document.getElementById('search-input')?.focus(), 0);
  }

  function navigate(tab: string) {
    devLog('[layout] navigate called: tab=', tab, 'currentTab was=', currentTab);
    if (currentTab !== 'settings' && currentTab !== 'builder' && !currentTab.startsWith('queries:')) prevTab = currentTab;
    currentTab = tab;
    devLog('[layout] currentTab now=', currentTab);
  }

  function handleSearchTaskTap(task: Task) {
    searchSelectedTask = task;
  }

  function handleSearchTaskChanged() {
    searchSelectedTask = null;
    loadInbox();
  }

  function handleQueryToggle(task: Task) {
    return toggleTaskDone(task, () => {
      if (currentTab.startsWith('queries:')) {
        const parts = currentTab.split(':');
        runQuery(parts[1], parts[2] ? parseInt(parts[2]) : undefined);
      }
    });
  }

  const pageTitle = $derived(
    getIsActive() ? 'Search'
    : currentTab === 'inbox' ? 'Task List'
    : currentTab === 'today' ? 'Today'
    : currentTab === 'global' ? 'All Tasks'
    : currentTab === 'queries' ? 'Queries'
    : currentTab === 'builder' ? 'New Query'
    : currentTab === 'settings' ? 'Settings'
    : currentTab.startsWith('queries:') ? (getCurrentQueryTitle() || 'Query Results')
    : ''
  );
</script>

{#if getIsDesktop()}
  <DesktopShell activeView={currentTab} onNavigate={navigate} />
{:else}
  <div class="app-shell">
    <ServiceErrorBanner />
    <header class="app-header" style="padding-top: var(--safe-area-top)">
      <div class="header-content">
        {#if getIsActive()}
          <button class="header-btn" onclick={() => deactivateSearch()} aria-label="Back"><Icon name="arrow-left" /></button>
        {/if}
        <h1 class="app-title">{pageTitle}</h1>
        {#if !getIsActive() && currentTab !== 'settings' && currentTab !== 'builder' && !currentTab.startsWith('queries:')}
          <button class="header-btn" onclick={handleSearchClick} aria-label="Search">
            <Icon name="search" />
          </button>
          <SpaceSwitcher />
          <button class="header-btn" onclick={() => navigate('settings')} aria-label="Settings">
            <Icon name="settings" />
          </button>
        {:else if !getIsActive() && (currentTab === 'settings' || currentTab === 'builder' || currentTab.startsWith('queries:'))}
          <button class="header-btn" onclick={() => navigate(prevTab)} aria-label="Back"><Icon name="arrow-left" /></button>
        {/if}
      </div>
    </header>
    {#if getIsActive()}
      <SearchBar />
      <main class="app-main search-active">
        {#if getQuery() && getResults().length === 0 && !getIsSearching()}
          <div class="search-empty">No results for &ldquo;{getQuery()}&rdquo;</div>
        {:else if getResults().length > 0}
          <TaskList tasks={getResults()} onTaskTap={handleSearchTaskTap} emptyMessage="No results" showSpace />
        {:else if getIsSearching()}
          <div class="search-empty">Searching&hellip;</div>
        {:else}
          <div class="search-empty">Type to search tasks</div>
        {/if}
      </main>
      {#if searchSelectedTask}
        <TaskDetail task={searchSelectedTask} variant="overlay" onclose={() => (searchSelectedTask = null)} ontaskchanged={handleSearchTaskChanged} />
      {/if}
    {:else}
      <main class="app-main">
        {#if currentTab === 'inbox'}<InboxPage />
        {:else if currentTab === 'today'}<TodayPage />
        {:else if currentTab === 'global'}<GlobalPage />
        {:else if currentTab === 'queries'}<QueriesPage onNavigate={navigate} />
        {:else if currentTab === 'builder'}<BuilderPage />
        {:else if currentTab.startsWith('queries:')}
          {#if getQueryLoading()}
            <div class="search-empty">Running query...</div>
          {:else if getQueryError()}
            <div class="search-empty">{getQueryError()}</div>
          {:else}
            <TaskList tasks={getCurrentQueryTasks()} onTaskTap={(t) => (querySelectedTask = t)} onToggleDone={handleQueryToggle} emptyMessage="No tasks matched." showSpace />
          {/if}
        {:else}<SettingsPage />{/if}
      </main>
    {/if}
    {#if querySelectedTask}
      <TaskDetail task={querySelectedTask} variant="overlay" onclose={() => (querySelectedTask = null)} />
    {/if}
    <nav class="tab-bar" role="tablist" aria-label="Main navigation" style="padding-bottom: var(--safe-area-bottom)">
      <button class="tab-button" class:active={currentTab === 'inbox'} role="tab" aria-selected={currentTab === 'inbox'} onclick={() => navigate('inbox')}>
        <span class="tab-icon"><Icon name="inbox" /></span><span class="tab-label">Tasks</span>
      </button>
      {#if getShowToday()}
        <button class="tab-button" class:active={currentTab === 'today'} role="tab" aria-selected={currentTab === 'today'} onclick={() => navigate('today')}>
          <span class="tab-icon"><Icon name="calendar" /></span><span class="tab-label">Today</span>
        </button>
      {/if}
      <button class="tab-button" class:active={currentTab === 'global'} role="tab" aria-selected={currentTab === 'global'} onclick={() => navigate('global')}>
        <span class="tab-icon"><Icon name="globe" /></span><span class="tab-label">All</span>
      </button>
      <button class="tab-button" class:active={currentTab === 'queries' || currentTab.startsWith('queries:')} role="tab" aria-selected={currentTab === 'queries' || currentTab.startsWith('queries:')} onclick={() => navigate('queries')}>
        <span class="tab-icon"><Icon name="search" /></span><span class="tab-label">Queries</span>
      </button>
    </nav>
    {#if currentTab !== 'settings' && currentTab !== 'builder' && !currentTab.startsWith('queries:') && !getIsActive()}<FloatingAddButton />{/if}
  </div>
{/if}
{#if getShowOnboarding()}
  <OnboardingModal />
{/if}
<Toast />

{#if showShortcuts}
  <KeyboardShortcuts platform="mobile" onclose={() => (showShortcuts = false)} />
{/if}

<PrivacyConsent bind:this={consentRef} />

<style>
  .app-shell { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }
  .app-header { background: var(--color-bg); border-bottom: 0.5px solid var(--color-separator); z-index: var(--z-header); flex-shrink: 0; }
  .header-content { display: flex; align-items: center; gap: var(--space-2); justify-content: space-between; padding: var(--space-3) var(--space-4); }
  .app-title { font-size: var(--font-size-xl); font-weight: var(--font-weight-bold); color: var(--color-text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .app-main { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
  .app-main.search-active { overflow-y: auto; }
  .tab-bar { display: flex; padding: var(--space-2) var(--space-4); background: var(--color-bg); border-top: 0.5px solid var(--color-separator); flex-shrink: 0; }
  .tab-button { display: flex; flex-direction: column; align-items: center; gap: 0.125rem; padding: var(--space-1) var(--space-4); border-radius: var(--radius-md); flex: 1; }
  .tab-button.active .tab-label { color: var(--color-accent); font-weight: var(--font-weight-semibold); }
  .tab-icon { font-size: var(--font-size-xl); } .tab-label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
  .header-btn { display: flex; align-items: center; justify-content: center; color: var(--color-text-secondary); padding: var(--space-1); border-radius: var(--radius-md); flex-shrink: 0; }
  .header-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text); }
  .search-empty { display: flex; align-items: center; justify-content: center; padding: 3rem var(--space-4); color: var(--color-text-secondary); font-size: var(--font-size-sm); }
</style>
