<script lang="ts">
  import Icon from './Icon.svelte';
  import { getSpacesList, getActiveId, setActiveSpace, getSpacesLoading, loadSpaces } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { loadTaskNames } from '$lib/stores/tasknames.svelte';
  import { isDesktopApp, setActiveSpaceDesktop } from '$lib/desktop-bridge';

  let {
    activeView,
    onNavigate,
  }: {
    activeView: 'inbox' | 'today' | 'settings';
    onNavigate: (view: string) => void;
  } = $props();

  let spaceOpen = $state(false);

  const items = $derived([
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'today', label: 'Today', icon: 'calendar' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ]);

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
  }
</script>

<nav class="sidebar" role="navigation" aria-label="Main navigation">
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
      <span class="space-chevron" aria-hidden="true">{spaceOpen ? '▲' : '▼'}</span>
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
              <span class="space-check">{space.id === getActiveId() ? '✓' : ''}</span>
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
</nav>

{#if spaceOpen}
  <div class="backdrop" onclick={() => (spaceOpen = false)} aria-hidden="true"></div>
{/if}

<style>
  .sidebar {
    width: 220px;
    min-width: 220px;
    background: var(--color-bg-secondary);
    border-right: 1px solid var(--color-separator);
    display: flex;
    flex-direction: column;
    padding: 0.75rem;
    gap: 0.25rem;
    height: 100%;
    position: relative;
    z-index: 1;
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
    z-index: 200;
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
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
  }
</style>
