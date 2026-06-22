<script lang="ts">
  import { onMount } from 'svelte';
  import { getServiceState } from '$lib/stores/service.svelte';
  import { getActiveId } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { loadTagNames } from '$lib/stores/tagnames.svelte';
  import { getIsDesktop, setDesktopMode } from '$lib/stores/desktop.svelte';
  import { hideSplash } from '$lib/native/splash';
  import { setDarkStyle } from '$lib/native/status-bar';
  import QuickCapture from '$lib/components/QuickCapture.svelte';
  import SpaceSwitcher from '$lib/components/SpaceSwitcher.svelte';
  import ServiceErrorBanner from '$lib/components/ServiceErrorBanner.svelte';
  import DesktopShell from '$lib/components/DesktopShell.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import InboxPage from './inbox/+page.svelte';
  import TodayPage from './today/+page.svelte';
  import GlobalPage from './global/+page.svelte';
  import SettingsPage from './settings/+page.svelte';
  import { goto } from '$lib/router';
  import SearchBar from '$lib/components/SearchBar.svelte';
  import TaskList from '$lib/components/TaskList.svelte';
  import { getResults, getQuery, getIsActive, getIsSearching, activateSearch, deactivateSearch } from '$lib/stores/search.svelte';
  import { getDefaultView, getShowToday, loadShowToday } from '$lib/stores/landing.svelte';

  let { activeTab = getDefaultView() }: { activeTab?: string } = $props();
  let currentTab = $state<string>(activeTab);

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
        document.getElementById('quick-input')?.focus();
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
    }
  }

  $effect(() => { document.addEventListener('keydown', handleGlobalKeydown); return () => document.removeEventListener('keydown', handleGlobalKeydown); });

  $effect(() => {
    function check() { setDesktopMode(window.innerWidth >= 800); }
    check();
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
              window.open(link.href, '_blank');
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

  function navigate(tab: string) { currentTab = tab; goto(`/${tab}`); }
</script>

{#if getIsDesktop()}
  <DesktopShell activeView={currentTab} onNavigate={navigate} />
{:else}
  <div class="app-shell">
    <ServiceErrorBanner />
    <header class="app-header" style="padding-top: var(--safe-area-top)">
      <div class="header-content">
        {#if getIsActive()}
          <button class="search-back-btn" onclick={() => deactivateSearch()} aria-label="Back">&larr;</button>
        {/if}
        <h1 class="app-title">{getIsActive() ? 'Search' : currentTab === 'inbox' ? 'Task List' : currentTab === 'today' ? 'Today' : currentTab === 'global' ? 'All Tasks' : currentTab === 'settings' ? 'Settings' : ''}</h1>
        {#if !getIsActive() && currentTab !== 'settings'}
          <SpaceSwitcher />
          <button class="gear-btn" onclick={() => navigate('settings')} aria-label="Settings">
            <Icon name="settings" />
          </button>
        {:else if !getIsActive() && currentTab === 'settings'}
          <button class="gear-btn" onclick={() => navigate('inbox')} aria-label="Back">&larr;</button>
        {/if}
      </div>
    </header>
    {#if getIsActive()}
      <SearchBar />
      <main class="app-main search-active">
        {#if getQuery() && getResults().length === 0 && !getIsSearching()}
          <div class="search-empty">No results for &ldquo;{getQuery()}&rdquo;</div>
        {:else if getResults().length > 0}
          <TaskList tasks={getResults()} emptyMessage="No results" />
        {:else if getIsSearching()}
          <div class="search-empty">Searching&hellip;</div>
        {:else}
          <div class="search-empty">Type to search tasks</div>
        {/if}
      </main>
    {:else}
      <main class="app-main">
        {#if currentTab === 'inbox'}<InboxPage />{:else if currentTab === 'today'}<TodayPage />{:else if currentTab === 'global'}<GlobalPage />{:else}<SettingsPage />{/if}
      </main>
    {/if}
    <nav class="tab-bar" role="tablist" aria-label="Main navigation" style="padding-bottom: var(--safe-area-bottom)">
      <button class="tab-button" class:active={currentTab === 'inbox'} role="tab" aria-selected={currentTab === 'inbox'} onclick={() => navigate('inbox')}>
        <span class="tab-icon"><Icon name="inbox" /></span><span class="tab-label">Task List</span>
      </button>
      {#if getShowToday()}
        <button class="tab-button" class:active={currentTab === 'today'} role="tab" aria-selected={currentTab === 'today'} onclick={() => navigate('today')}>
          <span class="tab-icon"><Icon name="calendar" /></span><span class="tab-label">Today</span>
        </button>
      {/if}
      <button class="tab-button" class:active={currentTab === 'global'} role="tab" aria-selected={currentTab === 'global'} onclick={() => navigate('global')}>
        <span class="tab-icon"><Icon name="globe" /></span><span class="tab-label">All</span>
      </button>
    </nav>
    {#if currentTab !== 'settings' && !getIsActive()}<div class="quick-capture-container"><QuickCapture /></div>{/if}
  </div>
{/if}

<style>
  .app-shell { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }
  .app-header { background: var(--color-bg); border-bottom: 0.5px solid var(--color-separator); z-index: 10; flex-shrink: 0; }
  .header-content { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; }
  .app-title { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-text); }
  .app-main { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
  .tab-bar { display: flex; justify-content: center; gap: 2rem; padding: 0.5rem 1rem; background: var(--color-bg); border-top: 0.5px solid var(--color-separator); flex-shrink: 0; }
  .tab-button { display: flex; flex-direction: column; align-items: center; gap: 0.125rem; padding: 0.25rem 1rem; border-radius: var(--radius-md); }
  .tab-button.active .tab-label { color: var(--color-accent); font-weight: 600; }
  .tab-icon { font-size: 1.25rem; } .tab-label { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
  .quick-capture-container { flex-shrink: 0; background: var(--color-bg); }
  .search-back-btn { background: none; border: none; font-size: 1.25rem; color: var(--color-accent); padding: 0; cursor: pointer; }
  .gear-btn { background: none; border: none; color: var(--color-text-secondary); cursor: pointer; padding: 0.25rem; display: flex; align-items: center; border-radius: var(--radius-md); }
  .gear-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text); }
  .main.search-active { overflow-y: auto; }
  .search-empty { display: flex; align-items: center; justify-content: center; padding: 3rem 1rem; color: var(--color-text-secondary); font-size: var(--font-size-sm); }
</style>
