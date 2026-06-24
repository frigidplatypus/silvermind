<script lang="ts">
  import Icon from './Icon.svelte';
  import { getSpacesList, getActiveId, setActiveSpace, getSpacesLoading, loadSpaces } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { loadTagNames } from '$lib/stores/tagnames.svelte';
  import { getQueryPagesList, getQueryPagesLoading, getQueryPagesError, loadQueryPages } from '$lib/stores/queries.svelte';
  import { getShowToday } from '$lib/stores/landing.svelte';
  import { isDesktopApp, setActiveSpaceDesktop } from '$lib/desktop-bridge';

  let {
    activeView,
    onNavigate,
    width = 220,
  }: {
    activeView: string;
    onNavigate: (view: string) => void;
    width?: number;
  } = $props();

  let spaceOpen = $state(false);

  const activeSpaceId = $derived(getActiveId());

  $effect(() => {
    loadQueryPages();
  });

  // Reload query pages when space changes
  $effect(() => {
    if (activeSpaceId) {
      loadQueryPages();
    }
  });

  let refreshingQueries = $state(false);

  async function handleRefreshQueries() {
    refreshingQueries = true;
    try {
      await loadQueryPages();
    } finally {
      refreshingQueries = false;
    }
  }

  const items = $derived.by(() => {
    const list = [
      { id: 'inbox', label: 'Task List', icon: 'inbox' },
      { id: 'global', label: 'All Tasks', icon: 'globe' },
    ];
    if (getShowToday()) list.splice(1, 0, { id: 'today', label: 'Today', icon: 'calendar' });
    return list;
  });

  const activeSpace = $derived(getSpacesList().find((s) => s.id === getActiveId()));

  async function selectSpace(spaceId: string) {
    spaceOpen = false;
    const space = getSpacesList().find((s) => s.id === spaceId);
    if (!space) return;
    if (isDesktopApp()) {
      try {
        await setActiveSpaceDesktop(space.name);
        setActiveSpace(spaceId);
        await loadSpaces();
      } catch { /* handled by loadSpaces fallback */ }
    } else {
      setActiveSpace(spaceId);
    }
    loadInbox();
    loadTaskNames();
    loadTagNames();
  }
</script>

<nav class="sidebar" class:collapsed={width === 0} style="width: {width}px" role="navigation" aria-label="Main navigation">
  <div class="sidebar-brand"><Icon name="layers" size="1.25rem" /> Silvermind</div>

  <div class="sidebar-section-label">Space</div>
  <div class="space-selector">
    <button
      class="space-trigger"
      onclick={() => (spaceOpen = !spaceOpen)}
      aria-haspopup="listbox"
      aria-expanded={spaceOpen}
    >
      <span class="space-trigger-label">{activeSpace?.name ?? 'No space'}</span>
      <span class="space-chevron" aria-hidden="true"><Icon name={spaceOpen ? 'chevron-up' : 'chevron-down'} size="0.75rem" /></span>
    </button>
    {#if spaceOpen}
      <div class="space-dropdown" role="listbox" aria-label="Select space">
        {#if getSpacesLoading()}
          <div class="dropdown-loading">Loading…</div>
        {:else}
          {#each getSpacesList() as space (space.id)}
            <button
              class="space-option"
              class:active={space.id === getActiveId()}
              role="option"
              aria-selected={space.id === getActiveId()}
              onclick={() => selectSpace(space.id)}
            >
              <span class="space-check">{#if space.id === getActiveId()}<Icon name="check" size="0.875rem" />{/if}</span>
              <span>{space.name}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <div class="sidebar-section-label" style="margin-top: 0.75rem">Views</div>
  {#each items as item}
    <button
      class="sidebar-item"
      class:active={activeView === item.id}
      onclick={() => onNavigate(item.id)}
      aria-current={activeView === item.id ? 'page' : undefined}
    >
      <Icon name={item.icon} />
      <span>{item.label}</span>
    </button>
  {/each}

  <div class="sidebar-section-label" style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem">
    <span><Icon name="search" size="0.75rem" /> Queries</span>
    <div class="sidebar-actions">
      <button class="add-btn" onclick={() => onNavigate('builder')} aria-label="New query">
        <Icon name="plus" size="0.75rem" />
      </button>
      <button class="refresh-btn" onclick={handleRefreshQueries} aria-label="Refresh query pages" disabled={refreshingQueries}>
        <Icon name="rotate-cw" size="0.75rem" />
      </button>
    </div>
  </div>
  {#if getQueryPagesLoading()}
    <div class="query-loading">Checking for queries…</div>
  {:else if getQueryPagesError()}
    <div class="query-error">{getQueryPagesError()}</div>
  {:else if getQueryPagesList().length > 0}
    {#each getQueryPagesList() as qp}
      {#if qp.blocks.length === 1}
        <button
          class="sidebar-item query-page-toggle"
          class:active={activeView === `queries:${qp.page}:1`}
          onclick={() => onNavigate(`queries:${qp.page}:1`)}
        >
          {#if qp.page.includes('/') && !qp.page.startsWith('queries/')}
            <span class="query-page-name">
              <span class="query-page-folder">{qp.page.split('/').slice(0, -1).join('/')}/</span>
              {qp.page.split('/').pop()}
            </span>
          {:else}
            <span class="query-page-name">{qp.page.startsWith('queries/') ? qp.page.slice(8) : qp.page}</span>
          {/if}
          {#if qp.errors && qp.errors.length > 0}
            <Icon name="alert-triangle" size="0.75rem" />
          {/if}
        </button>
      {:else}
        <div class="query-page-group">
          <button
            class="sidebar-item query-page-toggle"
            class:active={activeView.startsWith(`queries:${qp.page}`)}
            onclick={() => onNavigate(`queries:${qp.page}`)}
          >
            {#if qp.page.includes('/') && !qp.page.startsWith('queries/')}
              <span class="query-page-name">
                <span class="query-page-folder">{qp.page.split('/').slice(0, -1).join('/')}/</span>
                {qp.page.split('/').pop()}
              </span>
            {:else}
              <span class="query-page-name">{qp.page.startsWith('queries/') ? qp.page.slice(8) : qp.page}</span>
            {/if}
            {#if qp.errors && qp.errors.length > 0}
              <Icon name="alert-triangle" size="0.75rem" />
            {/if}
          </button>
          {#each qp.blocks as block}
            <button
              class="sidebar-item sidebar-item-child"
              class:active={activeView === `queries:${qp.page}:${block.number}`}
              onclick={() => onNavigate(`queries:${qp.page}:${block.number}`)}
            >
              <Icon name="chevron-right" size="0.75rem" />
              <span>{block.title}</span>
            </button>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}

  <div class="sidebar-spacer"></div>

  <button
    class="sidebar-item"
    class:active={activeView === 'settings'}
    onclick={() => onNavigate('settings')}
    aria-current={activeView === 'settings' ? 'page' : undefined}
  >
    <Icon name="settings" />
    <span>Settings</span>
  </button>
</nav>
<style>
  .sidebar {
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-separator);
    display: flex;
    flex-direction: column;
    padding: var(--space-3);
    gap: 0.25rem;
    height: 100%;
    position: relative;
    z-index: var(--z-base);
    flex-shrink: 0;
  }
  .sidebar.collapsed {
    padding: 0;
    border-right: none;
    overflow: hidden;
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text);
    padding: 0.5rem 0.75rem 0.75rem;
  }
  .sidebar-section-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-tertiary);
    padding: 0.25rem 0.75rem;
  }
  .sidebar-item {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    width: 100%;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-base);
    color: var(--color-text-secondary);
    text-align: left;
    transition: background 0.1s ease;
  }
  .sidebar-item:hover {
    background: var(--color-bg-tertiary);
  }
  .sidebar-item.active {
    background: var(--color-accent-light);
    color: var(--color-accent);
    font-weight: 600;
  }
  .space-selector {
    position: relative;
    padding: 0 0.75rem 0.25rem;
  }
  .space-trigger {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-tertiary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
    gap: 0.375rem;
  }
  .space-trigger:hover {
    background: var(--color-border);
  }
  .space-trigger-label {
    flex: 1;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .space-chevron {
    font-size: 0.625rem;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }
  .space-dropdown {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    margin-top: 0.25rem;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px var(--color-shadow);
    z-index: calc(var(--z-dropdown) + 1);
    overflow: hidden;
  }
  .dropdown-loading {
    padding: 0.625rem;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    text-align: center;
  }
  .space-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    text-align: left;
  }
  .space-option:hover {
    background: var(--color-bg-tertiary);
  }
  .space-option.active {
    font-weight: 600;
    color: var(--color-accent);
  }
  .space-check {
    width: 1.125rem;
    color: var(--color-accent);
    font-weight: 600;
    flex-shrink: 0;
  }
  .query-page-group {
    margin-bottom: 0.125rem;
  }
  .query-page-name {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .query-page-folder {
    color: var(--color-text-tertiary);
    font-weight: 400;
    font-size: var(--font-size-xs);
  }
  .sidebar-item-child {
    padding-left: 2rem;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
  .sidebar-item-child.active {
    color: var(--color-accent);
    font-weight: 600;
  }
  .query-page-toggle.active {
    font-weight: 600;
  }
  .query-loading {
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
  .query-error {
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-xs);
    color: var(--color-danger);
    line-height: 1.4;
  }
  .sidebar-actions {
    display: flex;
    gap: 0.125rem;
  }
  .add-btn, .refresh-btn {
    padding: 0.125rem;
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-btn:hover, .refresh-btn:hover { color: var(--color-accent); }
  .refresh-btn:disabled { opacity: 0.4; }
  .sidebar-spacer { flex: 1; }
</style>
