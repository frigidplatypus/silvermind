<script lang="ts">
  import { getSpacesList, getActiveSpace, getActiveId, setActiveSpace, getSpacesLoading } from '$lib/stores/space.svelte';
  import Icon from './Icon.svelte';

  let isOpen = $state(false);

  function toggle() { isOpen = !isOpen; }
  function selectSpace(spaceId: string) { setActiveSpace(spaceId); isOpen = false; }
</script>

<div class="space-switcher">
  <button
    class="switcher-btn"
    onclick={toggle}
    aria-label="Select workspace. Current: {getActiveSpace()?.name ?? 'No spaces'}"
    aria-haspopup="true"
    aria-expanded={isOpen}
  >
    <span class="switcher-label">{getActiveSpace()?.name ?? 'No spaces'}</span>
    <span class="switcher-chevron" aria-hidden="true"><Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size="0.75rem" /></span>
  </button>

  {#if isOpen}
    <div class="space-menu" role="menu" aria-label="Workspaces" onkeydown={(e) => { if (e.key === 'Escape') isOpen = false; }}>
      {#if getSpacesLoading()}
        <div class="menu-loading">Loading spaces…</div>
      {:else}
        {#each getSpacesList() as space (space.id)}
          <button
            class="menu-item"
            class:active={space.id === getActiveId()}
            role="menuitemradio"
            aria-checked={space.id === getActiveId()}
            onclick={() => selectSpace(space.id)}
          >
            <span class="checkmark">{#if space.id === getActiveId()}<Icon name="check" size="0.875rem" />{/if}</span>
            <span>{space.name}</span>
          </button>
        {/each}
      {/if}
    </div>
  {/if}

  {#if isOpen}
    <div class="backdrop" onclick={() => (isOpen = false)} aria-hidden="true"></div>
  {/if}
</div>

<style>
  .space-switcher {
    position: relative;
  }

  .switcher-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    color: var(--color-text);
  }

  .switcher-label {
    max-width: 120px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .switcher-chevron {
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }

  .space-menu {
    position: absolute;
    top: 100%;
    right: 0;
    margin-top: 0.375rem;
    min-width: 180px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    box-shadow: 0 4px 12px var(--color-shadow);
    z-index: 100;
    overflow: hidden;
  }

  .menu-loading {
    padding: 0.75rem;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    text-align: center;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.625rem 0.875rem;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    text-align: left;
  }

  .menu-item:active {
    background: var(--color-bg-tertiary);
  }

  .menu-item.active {
    font-weight: 600;
    color: var(--color-accent);
  }

  .checkmark {
    width: 1.25rem;
    color: var(--color-accent);
    font-weight: 600;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 99;
  }
</style>
