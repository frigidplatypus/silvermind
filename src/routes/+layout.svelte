<script lang="ts">
  import { onMount } from 'svelte';
  import { getServiceState, initServiceListener } from '$lib/stores/service.svelte';
  import { getActiveId } from '$lib/stores/space.svelte';
  import { addTask, loadInbox } from '$lib/stores/tasks.svelte';
  import { toggleTaskDone } from '$lib/helpers/task-actions';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { loadTagNames } from '$lib/stores/tagnames.svelte';
  import { getIsDesktop, setDesktopMode } from '$lib/stores/desktop.svelte';
  import { hideSplash } from '$lib/native/splash';
  import { openExternalUrl } from '$lib/native/browser';
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
  import {
    getResults,
    getQuery,
    getIsActive,
    getIsSearching,
    activateSearch,
    deactivateSearch,
  } from '$lib/stores/search.svelte';
  import { getDefaultView, getShowToday, loadShowToday } from '$lib/stores/landing.svelte';
  import type { Task } from '$lib/types/task';
  import QueriesPage from './queries/+page.svelte';
  import {
    getCurrentQueryTasks,
    getCurrentQueryTitle,
    getQueryLoading,
    getQueryError,
    runQuery,
    clearQueryResults,
    loadQueryPages,
  } from '$lib/stores/queries.svelte';
  import { devLog } from '$lib/helpers/dev-log';
  import { goto } from '$lib/router';
  import { consumePendingIntent, handleIncomingIntent } from '$lib/native/siri';
  import { showError, showSuccess } from '$lib/stores/toast.svelte';
  import { notifyError, notifySuccess } from '$lib/native/haptics';

  let { activeTab = getDefaultView() }: { activeTab?: string } = $props();
  // svelte-ignore state_referenced_locally
  let currentTab = $state<string>(activeTab);
  let prevTab = $state<string>('inbox');
  let searchSelectedTask = $state<Task | null>(null);
  let querySelectedTask = $state<Task | null>(null);
  let showShortcuts = $state(false);
  let consentRef: { show(): void } | undefined = $state();
  let uiDebugEnabled = $state(false);
  let uiDebugLastEvent = $state('none');
  let uiDebugBottomStack = $state('');

  function formatDebugElement(el: Element | null): string {
    if (!(el instanceof HTMLElement)) return 'unknown';
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const classes =
      el.className && typeof el.className === 'string'
        ? `.${el.className.trim().split(/\s+/).filter(Boolean).join('.')}`
        : '';
    return `${tag}${id}${classes}`;
  }

  function updateUIDebug(type: string, target: EventTarget | null, x?: number, y?: number) {
    const coords = x !== undefined && y !== undefined ? ` @ ${Math.round(x)},${Math.round(y)}` : '';
    uiDebugLastEvent = `${type}${coords} -> ${formatDebugElement(target as Element | null)}`;
    if (x !== undefined && y !== undefined) {
      uiDebugBottomStack = document
        .elementsFromPoint(x, y)
        .slice(0, 5)
        .map((el) => formatDebugElement(el))
        .join(' > ');
    }
    logInfo(
      `[ui-debug] ${uiDebugLastEvent}${uiDebugBottomStack ? ` :: ${uiDebugBottomStack}` : ''}`,
    );
  }

  function decodeQueryPage(page: string): string {
    try {
      return decodeURIComponent(page);
    } catch {
      return page;
    }
  }

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

  $effect(() => {
    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  });

  $effect(() => {
    function check() {
      setDesktopMode(window.innerWidth >= 800);
    }
    check();
    logInfo(
      `[layout] initial isDesktop check: width=${window.innerWidth} desktop=${getIsDesktop()}`,
    );
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  });

  $effect(() => {
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
        if (
          !link.href.startsWith('http://127.0.0.1') &&
          !link.href.startsWith('http://localhost')
        ) {
          e.preventDefault();
          const goApp = (window as any).go?.main?.App;
          if (goApp?.OpenURL) {
            goApp.OpenURL(link.href);
          } else {
            const wailsRuntime = (window as any).runtime;
            if (wailsRuntime?.BrowserOpenURL) {
              wailsRuntime.BrowserOpenURL(link.href);
            } else {
              openExternalUrl(link.href).then((opened) => {
                if (!opened) {
                  window.open(link.href, '_blank');
                }
              });
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
    if (spaceId) {
      loadInbox();
      loadTaskNames();
      loadTagNames();
    }
  });

  $effect(() => {
    if (currentTab.startsWith('queries:')) {
      const parts = currentTab.slice(8).split(':');
      const page = decodeQueryPage(parts[0]);
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

  async function handleShortcutIntent(
    intentName: string,
    parameters?: Record<string, unknown>,
  ): Promise<void> {
    const rawTitle = typeof parameters?.title === 'string' ? parameters.title.trim() : '';
    logInfo(
      `[shortcuts] received intent="${intentName}" title="${rawTitle.slice(0, 120)}" activeSpace="${getActiveId() || ''}"`,
    );

    if (intentName === 'OpenQuickAdd' || (intentName === 'AddTaskIntent' && !rawTitle)) {
      navigate('inbox');
      setTimeout(() => triggerAddTask(), 0);
      showSuccess('Quick Add opened');
      return;
    }

    if (intentName === 'AddTaskIntent') {
      navigate('inbox');
      const task = await addTask(rawTitle);
      if (task) {
        notifySuccess();
        showSuccess(`Task added to ${task.page}`);
      } else {
        notifyError();
        showError('Shortcut task add failed');
      }
    }
  }

  onMount(() => {
    logInfo(`[layout] onMount — isDesktop=${getIsDesktop()} tab=${currentTab}`);
    initServiceListener();
    uiDebugEnabled =
      new URLSearchParams(window.location.search).get('debug-ui') === '1' ||
      localStorage.getItem('silvermind-debug-ui') === '1';

    const captureTouchStart = (e: TouchEvent) => {
      if (!uiDebugEnabled) return;
      const touch = e.touches[0];
      updateUIDebug('touchstart', e.target, touch?.clientX, touch?.clientY);
    };
    const captureTouchEnd = (e: TouchEvent) => {
      if (!uiDebugEnabled) return;
      const touch = e.changedTouches[0];
      updateUIDebug('touchend', e.target, touch?.clientX, touch?.clientY);
    };
    const captureClick = (e: MouseEvent) => {
      if (!uiDebugEnabled) return;
      updateUIDebug('click', e.target, e.clientX, e.clientY);
    };

    const removeShortcutListener = handleIncomingIntent((intentName, parameters) => {
      handleShortcutIntent(intentName, parameters).catch((e) => {
        logInfo(`[shortcuts] live intent failed: ${e instanceof Error ? e.message : String(e)}`);
      });
    });

    consumePendingIntent()
      .then((pending: { intentName: string; parameters?: Record<string, unknown> } | null) => {
        if (!pending) return;
        return handleShortcutIntent(pending.intentName, pending.parameters);
      })
      .catch((e: any) => {
        logInfo(
          `[shortcuts] pending intent consume skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      });

    document.addEventListener('touchstart', captureTouchStart, true);
    document.addEventListener('touchend', captureTouchEnd, true);
    document.addEventListener('click', captureClick, true);

    const handleHashChange = () => {
      const hash = window.location.hash.slice(1).replace(/^\//, '');
      if (!hash) return;
      currentTab = hash;
    };

    window.addEventListener('hashchange', handleHashChange);

    // Show privacy consent after splash fades, before onboarding
    setTimeout(() => consentRef?.show(), 2000);

    return () => {
      document.removeEventListener('touchstart', captureTouchStart, true);
      document.removeEventListener('touchend', captureTouchEnd, true);
      document.removeEventListener('click', captureClick, true);
      window.removeEventListener('hashchange', handleHashChange);
      removeShortcutListener();
    };
  });

  function handleSearchClick() {
    activateSearch(currentTab === 'global' ? 'global' : 'active');
    setTimeout(() => document.getElementById('search-input')?.focus(), 0);
  }

  function navigate(tab: string) {
    devLog('[layout] navigate called: tab=', tab, 'currentTab was=', currentTab);
    if (currentTab !== 'settings' && currentTab !== 'builder' && !currentTab.startsWith('queries:'))
      prevTab = currentTab;
    currentTab = tab;
    goto(tab);
    devLog('[layout] currentTab now=', currentTab);
  }

  function handleTabTouch(tab: string, e: TouchEvent) {
    e.preventDefault();
    e.stopPropagation();
    navigate(tab);
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
    getIsActive()
      ? 'Search'
      : currentTab === 'inbox'
        ? 'Task List'
        : currentTab === 'today'
          ? 'Today'
          : currentTab === 'global'
            ? 'All Tasks'
            : currentTab === 'queries'
              ? 'Queries'
              : currentTab === 'builder'
                ? 'New Query'
                : currentTab === 'settings'
                  ? 'Settings'
                  : currentTab.startsWith('queries:')
                    ? (() => {
                        const parts = currentTab.split(':');
                        const raw = parts.slice(1, -1).join(':') || parts[1];
                        try {
                          return decodeURIComponent(raw);
                        } catch {
                          return raw;
                        }
                      })()
                    : '',
  );
</script>

{#if getIsDesktop()}
  <DesktopShell activeView={currentTab} onNavigate={navigate} />
{:else}
  <div class="app-shell">
    <ServiceErrorBanner />
    <header class="app-header">
      <div class="header-content">
        {#if getIsActive()}
          <button class="header-btn" onclick={() => deactivateSearch()} aria-label="Back"
            ><Icon name="arrow-left" /></button
          >
        {/if}
        <h1 class="app-title">{pageTitle}</h1>
        {#if !getIsActive() && currentTab !== 'settings' && currentTab !== 'builder' && !currentTab.startsWith('queries:')}
          <div class="header-actions">
            <button class="header-btn" onclick={handleSearchClick} aria-label="Search">
              <Icon name="search" />
            </button>
            <SpaceSwitcher />
          </div>
        {:else if !getIsActive() && (currentTab === 'settings' || currentTab === 'builder' || currentTab.startsWith('queries:'))}
          <button class="header-btn" onclick={() => navigate(prevTab)} aria-label="Back"
            ><Icon name="arrow-left" /></button
          >
        {/if}
      </div>
    </header>
    {#if getIsActive()}
      <SearchBar />
      <main class="app-main search-active">
        {#if getQuery() && getResults().length === 0 && !getIsSearching()}
          <div class="search-empty">No results for &ldquo;{getQuery()}&rdquo;</div>
        {:else if getResults().length > 0}
          <TaskList
            tasks={getResults()}
            onTaskTap={handleSearchTaskTap}
            emptyMessage="No results"
            showSpace
          />
        {:else if getIsSearching()}
          <div class="search-empty">Searching&hellip;</div>
        {:else}
          <div class="search-empty">Type to search tasks</div>
        {/if}
      </main>
      {#if searchSelectedTask}
        <TaskDetail
          task={searchSelectedTask}
          variant="overlay"
          onclose={() => (searchSelectedTask = null)}
          ontaskchanged={handleSearchTaskChanged}
        />
      {/if}
    {:else}
      <main class="app-main app-main-mobile">
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
            <TaskList
              tasks={getCurrentQueryTasks()}
              onTaskTap={(t) => (querySelectedTask = t)}
              onToggleDone={handleQueryToggle}
              emptyMessage="No tasks matched."
              showSpace
            />
          {/if}
        {:else}<SettingsPage />{/if}
      </main>
    {/if}
    {#if querySelectedTask}
      <TaskDetail
        task={querySelectedTask}
        variant="overlay"
        onclose={() => (querySelectedTask = null)}
      />
    {/if}
    <div
      class="tab-bar"
      role="tablist"
      aria-label="Main navigation"
      style="padding-bottom: var(--safe-area-bottom)"
    >
      <button
        type="button"
        class="tab-button"
        class:active={currentTab === 'inbox'}
        role="tab"
        aria-selected={currentTab === 'inbox'}
        onclick={() => navigate('inbox')}
        ontouchend={(e) => handleTabTouch('inbox', e)}
      >
        <span class="tab-icon"><Icon name="inbox" /></span><span class="tab-label">Tasks</span>
      </button>
      {#if getShowToday()}
        <button
          type="button"
          class="tab-button"
          class:active={currentTab === 'today'}
          role="tab"
          aria-selected={currentTab === 'today'}
          onclick={() => navigate('today')}
          ontouchend={(e) => handleTabTouch('today', e)}
        >
          <span class="tab-icon"><Icon name="calendar" /></span><span class="tab-label">Today</span>
        </button>
      {/if}
      <button
        type="button"
        class="tab-button"
        class:active={currentTab === 'global'}
        role="tab"
        aria-selected={currentTab === 'global'}
        onclick={() => navigate('global')}
        ontouchend={(e) => handleTabTouch('global', e)}
      >
        <span class="tab-icon"><Icon name="globe" /></span><span class="tab-label">All</span>
      </button>
      <button
        type="button"
        class="tab-button"
        class:active={currentTab === 'queries' || currentTab.startsWith('queries:')}
        role="tab"
        aria-selected={currentTab === 'queries' || currentTab.startsWith('queries:')}
        onclick={() => navigate('queries')}
        ontouchend={(e) => handleTabTouch('queries', e)}
      >
        <span class="tab-icon"><Icon name="search" /></span><span class="tab-label">Queries</span>
      </button>
      <button
        type="button"
        class="tab-button"
        class:active={currentTab === 'settings'}
        role="tab"
        aria-selected={currentTab === 'settings'}
        onclick={() => navigate('settings')}
        ontouchend={(e) => handleTabTouch('settings', e)}
      >
        <span class="tab-icon"><Icon name="settings" /></span><span class="tab-label">Settings</span
        >
      </button>
    </div>
    {#if currentTab !== 'settings' && currentTab !== 'builder' && !currentTab.startsWith('queries:') && !getIsActive()}<FloatingAddButton
      />{/if}
    {#if uiDebugEnabled}
      <div class="ui-debug-panel" aria-live="polite">
        <div><strong>tab</strong> {currentTab}</div>
        <div><strong>event</strong> {uiDebugLastEvent}</div>
        <div><strong>stack</strong> {uiDebugBottomStack || 'none'}</div>
      </div>
    {/if}
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
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: var(--color-bg);
  }
  .app-header {
    position: sticky;
    top: 0;
    background: var(--color-bg);
    border-bottom: 0.5px solid var(--color-separator);
    z-index: var(--z-header);
    flex-shrink: 0;
    padding-top: var(--safe-area-top);
  }
  :global(.task-editor-open) .app-header {
    display: none;
  }
  :global(.task-editor-open) .tab-bar {
    display: none;
  }
  .header-content {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    min-height: 3.5rem;
  }
  .app-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .header-actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    flex-shrink: 0;
    min-width: 0;
  }
  .app-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
  }
  .app-main-mobile {
    padding-bottom: calc(5rem + var(--safe-area-bottom));
  }
  .app-main.search-active {
    overflow-y: auto;
  }
  .tab-bar {
    display: flex;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: var(--z-modal);
    padding: var(--space-2) var(--space-3);
    background: var(--color-bg);
    border-top: 0.5px solid var(--color-separator);
    flex-shrink: 0;
    box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.06);
    pointer-events: auto;
    touch-action: manipulation;
  }
  .tab-button {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.125rem;
    justify-content: center;
    min-height: 3rem;
    min-width: 0;
    padding: var(--space-2) var(--space-1);
    border-radius: var(--radius-md);
    flex: 1;
    touch-action: manipulation;
    user-select: none;
    -webkit-user-select: none;
  }
  .tab-button.active .tab-label {
    color: var(--color-accent);
    font-weight: var(--font-weight-semibold);
  }
  .tab-icon {
    font-size: var(--font-size-xl);
  }
  .tab-label {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    white-space: nowrap;
  }
  .header-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
    padding: var(--space-1);
    border-radius: var(--radius-md);
    flex-shrink: 0;
  }
  .header-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text);
  }
  .search-empty {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 3rem var(--space-4);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .ui-debug-panel {
    position: fixed;
    top: calc(var(--safe-area-top) + 0.5rem);
    left: 0.5rem;
    right: 0.5rem;
    z-index: var(--z-toast);
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-md);
    background: rgba(0, 0, 0, 0.82);
    color: #fff;
    font-size: 0.7rem;
    line-height: 1.35;
    font-family: var(--font-family-mono);
    pointer-events: none;
    word-break: break-word;
  }
  @media (max-width: 420px) {
    .header-content {
      gap: var(--space-1);
      padding: var(--space-3);
      min-height: 3.25rem;
    }
    .app-title {
      font-size: var(--font-size-lg);
    }
    .header-actions {
      gap: var(--space-1);
    }
    .tab-bar {
      padding-left: max(var(--space-2), var(--safe-area-left));
      padding-right: max(var(--space-2), var(--safe-area-right));
    }
    .tab-button {
      min-height: 3.25rem;
      padding-inline: var(--space-1);
    }
    .tab-label {
      font-size: 0.625rem;
    }
  }
</style>
