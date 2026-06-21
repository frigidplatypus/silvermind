<script lang="ts">
  import Icon from './Icon.svelte';
  import { getQuery, setQuery, deactivateSearch, getIsSearching, getIsActive } from '$lib/stores/search.svelte';

  let inputEl: HTMLInputElement | undefined = $state();

  function handleInput() {
    setQuery(inputEl?.value ?? '');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      deactivateSearch();
    }
  }

  function handleClear() {
    deactivateSearch();
  }

  function handleBlur() {
    if (inputEl && !inputEl.value.trim()) {
      deactivateSearch();
    }
  }
</script>

<div class="search-bar" class:active={getIsActive()}>
  <div class="search-input-wrap">
    <span class="search-icon"><Icon name="search" size="1rem" /></span>
    <input
      id="search-input"
      bind:this={inputEl}
      type="search"
      class="search-input"
      placeholder="Search tasks…"
      value={getQuery()}
      oninput={handleInput}
      onkeydown={handleKeydown}
      onblur={handleBlur}
      autocomplete="off"
    />
    {#if getIsSearching()}
      <span class="search-spinner"><Icon name="loader" size="1rem" /></span>
    {/if}
    {#if getQuery()}
      <button class="clear-btn" onclick={handleClear} aria-label="Clear search">&times;</button>
    {/if}
  </div>
</div>

<style>
  .search-bar { padding: 0.5rem 1rem; border-bottom: 1px solid var(--color-separator); background: var(--color-bg); }
  .search-bar.active { background: var(--color-bg-secondary); }
  .search-input-wrap { display: flex; align-items: center; gap: 0.5rem; padding: 0.375rem 0.75rem; border-radius: var(--radius-lg); background: var(--color-bg-tertiary); }
  .search-bar.active .search-input-wrap { background: var(--color-surface); outline: 2px solid var(--color-accent); }
  .search-icon { color: var(--color-text-tertiary); display: flex; flex-shrink: 0; }
  .search-input { flex: 1; border: none; background: none; outline: none; font-size: var(--font-size-sm); color: var(--color-text); }
  .search-input::placeholder { color: var(--color-text-tertiary); }
  .search-spinner { animation: spin 1s linear infinite; display: flex; color: var(--color-text-tertiary); }
  @keyframes spin { to { transform: rotate(360deg); } }
  .clear-btn { border: none; background: none; color: var(--color-text-tertiary); font-size: 1.25rem; cursor: pointer; padding: 0; line-height: 1; }
  .clear-btn:hover { color: var(--color-text-secondary); }
</style>
