<script lang="ts">
  import Icon from './Icon.svelte';
  import LogoSvg from './LogoSvg.svelte';
  import {
    getSpacesList,
    getActiveId,
    setActiveSpace,
    getSpacesLoading,
  } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { loadTagNames } from '$lib/stores/tagnames.svelte';
  import {
    getQueryPagesList,
    getQueryPagesLoading,
    getQueryPagesError,
    loadQueryPages,
    getFavoriteQueries,
  } from '$lib/stores/queries.svelte';
  import { isQueryFavorite, toggleQueryFavorite } from '$lib/api/queries';
  import { getShowToday } from '$lib/stores/landing.svelte';
  import { logInfo } from '$lib/helpers/logger';

  let {
    activeView,
    onNavigate,
    width = 220,
    onToggleCollapse,
  }: {
    activeView: string;
    onNavigate: (view: string) => void;
    width?: number;
    onToggleCollapse?: () => void;
  } = $props();

  let spaceOpen = $state(false);

  const activeSpaceId = $derived(getActiveId());

  $effect(() => {
    logInfo('[sidebar] mount: loading query pages');
    loadQueryPages();
  });

  // Reload query pages when space changes
  $effect(() => {
    if (activeSpaceId) {
      logInfo(`[sidebar] space changed to "${activeSpaceId}": reloading query pages`);
      loadQueryPages();
    }
  });

  let refreshingQueries = $state(false);
  let refreshingInbox = $state(false);

  function flattenBlocks(): Array<{
    page: string;
    block: number;
    heading: string;
  }> {
    const result: Array<{ page: string; block: number; heading: string }> = [];
    for (const qp of getQueryPagesList()) {
      for (const b of qp.blocks) {
        result.push({ page: qp.page, block: b.number, heading: b.title });
      }
    }
    return result;
  }

  const favoriteBlockIds = $derived(
    new Set(getFavoriteQueries().map((f) => `${f.page}::${f.heading}`)),
  );

  const allBlocks = $derived(flattenBlocks());
  const favoriteBlocks = $derived(
    allBlocks.filter((b) => favoriteBlockIds.has(`${b.page}::${b.heading}`)),
  );
  const nonFavorites = $derived(
    allBlocks.filter((b) => !favoriteBlockIds.has(`${b.page}::${b.heading}`)),
  );

  async function handleToggleFavorite(page: string, heading: string, block: number, e: MouseEvent) {
    e.stopPropagation();
    await toggleQueryFavorite(page, heading, block);
    loadQueryPages(true);
  }

  async function handleRefreshInbox() {
    refreshingInbox = true;
    await loadInbox();
    refreshingInbox = false;
  }

  async function handleRefreshQueries() {
    refreshingQueries = true;
    try {
      await loadQueryPages(true);
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
    await setActiveSpace(spaceId);
    loadInbox();
    loadTaskNames();
    loadTagNames();
  }
</script>

<nav
  class="sidebar"
  class:collapsed={width <= 0}
  style="width: {width}px"
  aria-label="Main navigation"
>
  <div class="sidebar-brand">
    <LogoSvg size="1.25rem" /> <span>Silvermind</span>
  </div>

  <div class="sidebar-section-label">Space</div>
  <div class="space-selector">
    <button
      class="space-trigger"
      onclick={() => (spaceOpen = !spaceOpen)}
      aria-haspopup="listbox"
      aria-expanded={spaceOpen}
    >
      <span class="space-trigger-label">{activeSpace?.name ?? 'No space'}</span>
      <span class="space-chevron" aria-hidden="true"
        ><Icon name={spaceOpen ? 'chevron-up' : 'chevron-down'} size="0.75rem" /></span
      >
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
              <span class="space-check"
                >{#if space.id === getActiveId()}<Icon name="check" size="0.875rem" />{/if}</span
              >
              <span>{space.name}</span>
            </button>
          {/each}
        {/if}
      </div>
    {/if}
  </div>

  <div
    class="sidebar-section-label"
    style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem"
  >
    <span>Views</span>
    <button
      class="refresh-btn"
      onclick={handleRefreshInbox}
      aria-label="Refresh task list"
      disabled={refreshingInbox}
    >
      <Icon name="rotate-cw" size="0.75rem" />
    </button>
  </div>
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
  {#each favoriteBlocks as fav}
    <button
      class="sidebar-item"
      class:active={activeView === `queries:${fav.page}:${fav.block}`}
      onclick={() => onNavigate(`queries:${fav.page}:${fav.block}`)}
      aria-current={activeView === `queries:${fav.page}:${fav.block}` ? 'page' : undefined}
    >
      <Icon name="star" />
      <span>{fav.heading}</span>
    </button>
  {/each}

  <div
    class="sidebar-section-label"
    style="display:flex;justify-content:space-between;align-items:center;margin-top:0.75rem"
  >
    <span><Icon name="search" size="0.75rem" /> Queries</span>
    <div class="sidebar-actions">
      <button class="add-btn" onclick={() => onNavigate('builder')} aria-label="New query">
        <Icon name="plus" size="0.75rem" />
      </button>
      <button
        class="refresh-btn"
        onclick={handleRefreshQueries}
        aria-label="Refresh query pages"
        disabled={refreshingQueries}
      >
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
        <div class="sidebar-item query-item-row">
          <button
            class="query-star-toggle"
            class:star-empty={!favoriteBlockIds.has(`${qp.page}::${qp.blocks[0].title}`)}
            onclick={(e) =>
              handleToggleFavorite(qp.page, qp.blocks[0].title, qp.blocks[0].number, e)}
            aria-label={favoriteBlockIds.has(`${qp.page}::${qp.blocks[0].title}`)
              ? 'Remove from favorites'
              : 'Add to favorites'}
          >
            <Icon name="star" size="0.75rem" />
          </button>
          <button
            class="query-item-btn"
            class:active={activeView === `queries:${qp.page}:1`}
            onclick={() => onNavigate(`queries:${qp.page}:1`)}
          >
            {#if qp.page.includes('/') && !qp.page.startsWith('queries/')}
              <span class="query-page-name">
                <span class="query-page-folder">{qp.page.split('/').slice(0, -1).join('/')}/</span>
                {qp.page.split('/').pop()}
              </span>
            {:else}
              <span class="query-page-name"
                >{qp.page.startsWith('queries/') ? qp.page.slice(8) : qp.page}</span
              >
            {/if}
            {#if qp.errors && qp.errors.length > 0}
              <Icon name="alert-triangle" size="0.75rem" />
            {/if}
          </button>
        </div>
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
              <span class="query-page-name"
                >{qp.page.startsWith('queries/') ? qp.page.slice(8) : qp.page}</span
              >
            {/if}
            {#if qp.errors && qp.errors.length > 0}
              <Icon name="alert-triangle" size="0.75rem" />
            {/if}
          </button>
          {#each qp.blocks as block}
            <div class="sidebar-item sidebar-item-child query-item-row">
              <button
                class="query-star-toggle child-star"
                class:star-empty={!favoriteBlockIds.has(`${qp.page}::${block.title}`)}
                onclick={(e) => handleToggleFavorite(qp.page, block.title, block.number, e)}
                aria-label={favoriteBlockIds.has(`${qp.page}::${block.title}`)
                  ? 'Remove from favorites'
                  : 'Add to favorites'}
              >
                <Icon name="star" size="0.65rem" />
              </button>
              <button
                class="query-item-btn child-btn"
                class:active={activeView === `queries:${qp.page}:${block.number}`}
                onclick={() => onNavigate(`queries:${qp.page}:${block.number}`)}
              >
                <Icon name="chevron-right" size="0.75rem" />
                <span>{block.title}</span>
              </button>
            </div>
          {/each}
        </div>
      {/if}
    {/each}
  {/if}

  <div class="sidebar-spacer"></div>

  {#if onToggleCollapse}
    <div class="sidebar-bottom-actions">
      <button
        class="sidebar-item collapse-item"
        onclick={onToggleCollapse}
        aria-label="Collapse sidebar"
      >
        <Icon name="chevron-left" size="1rem" />
        <span>Collapse</span>
      </button>
      <button
        class="sidebar-item"
        class:active={activeView === 'settings'}
        onclick={() => onNavigate('settings')}
        aria-current={activeView === 'settings' ? 'page' : undefined}
      >
        <Icon name="settings" />
        <span>Settings</span>
      </button>
    </div>
  {/if}
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
    overflow-y: auto;
    overflow-x: hidden;
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
    color: var(--color-accent);
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
  .add-btn,
  .refresh-btn {
    padding: 0.125rem;
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .add-btn:hover,
  .refresh-btn:hover {
    color: var(--color-accent);
  }
  .refresh-btn:disabled {
    opacity: 0.4;
  }
  .sidebar-spacer {
    flex: 1;
  }
  .sidebar-bottom-actions {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--color-separator);
    padding-top: 0.25rem;
    margin-top: 0.25rem;
  }
  .collapse-item {
    color: var(--color-text-secondary);
  }
  .collapse-item:hover {
    color: var(--color-accent);
  }
  .query-item-row {
    display: flex;
    align-items: center;
    padding: 0;
    gap: 0;
  }
  .query-star-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }
  .query-star-toggle:hover {
    color: var(--color-accent);
  }
  .query-star-toggle:not(.star-empty) {
    color: var(--color-accent);
  }
  .query-star-toggle.child-star {
    padding: 0.25rem;
  }
  .query-item-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    padding: 0.375rem 0.5rem 0.375rem 0;
    border: none;
    background: none;
    cursor: pointer;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    text-align: left;
    border-radius: var(--radius-sm);
  }
  .query-item-btn:hover {
    background: var(--color-bg-hover);
    color: var(--color-text-primary);
  }
  .query-item-btn.active {
    background: var(--color-accent-bg);
    color: var(--color-accent);
  }
  .query-item-btn.child-btn {
    padding-left: 0;
  }
</style>
