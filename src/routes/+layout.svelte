<script lang="ts">
  import { getServiceState } from '$lib/stores/service.svelte';
  import { getActiveId } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
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
  import SettingsPage from './settings/+page.svelte';
  import { goto } from '$lib/router';

  let { activeTab = 'inbox' }: { activeTab?: string } = $props();
  let currentTab = $state<string>(activeTab);

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
    const spaceId = getActiveId();
    if (spaceId) { loadInbox(); loadTaskNames(); }
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
        <h1 class="app-title">{currentTab === 'inbox' ? 'Inbox' : currentTab === 'today' ? 'Today' : 'Settings'}</h1>
        {#if currentTab !== 'settings'}<SpaceSwitcher />{/if}
      </div>
    </header>
    <main class="app-main">
      {#if currentTab === 'inbox'}<InboxPage />{:else if currentTab === 'today'}<TodayPage />{:else}<SettingsPage />{/if}
    </main>
    <nav class="tab-bar" role="tablist" aria-label="Main navigation" style="padding-bottom: var(--safe-area-bottom)">
      <button class="tab-button" class:active={currentTab === 'inbox'} role="tab" aria-selected={currentTab === 'inbox'} onclick={() => navigate('inbox')}>
        <span class="tab-icon"><Icon name="inbox" /></span><span class="tab-label">Inbox</span>
      </button>
      <button class="tab-button" class:active={currentTab === 'today'} role="tab" aria-selected={currentTab === 'today'} onclick={() => navigate('today')}>
        <span class="tab-icon"><Icon name="calendar" /></span><span class="tab-label">Today</span>
      </button>
      <button class="tab-button" class:active={currentTab === 'settings'} role="tab" aria-selected={currentTab === 'settings'} onclick={() => navigate('settings')}>
        <span class="tab-icon"><Icon name="settings" /></span><span class="tab-label">Settings</span>
      </button>
    </nav>
    {#if currentTab !== 'settings'}<div class="quick-capture-container"><QuickCapture /></div>{/if}
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
</style>
