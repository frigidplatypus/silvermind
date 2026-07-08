<script lang="ts">
  import Icon from './Icon.svelte';

  let { onclose, platform = 'desktop' }: { onclose: () => void; platform?: 'desktop' | 'mobile' } = $props();

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') { onclose(); return; }
    if (e.key === '?' || e.key === '/') {
      e.preventDefault();
      onclose();
    }
  }

  const shortcuts = $derived(platform === 'desktop'
    ? [
        { key: 'n', label: 'New task' },
        { key: '/', label: 'Search tasks' },
        { key: 'j', label: 'Next task' },
        { key: 'k', label: 'Previous task' },
        { key: 'e', label: 'Edit task' },
        { key: 'd', label: 'Mark done' },
        { key: 'u', label: 'Undo done' },
        { key: 'Esc', label: 'Close / deselect' },
      ]
    : [
        { key: 'n', label: 'New task' },
        { key: '/', label: 'Search tasks' },
        { key: 'Esc', label: 'Close' },
      ]);
</script>

<div class="overlay" onclick={onclose} onkeydown={handleOverlayKeydown} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" tabindex="-1">
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
  <div class="sheet" onclick={(e) => e.stopPropagation()} role="document">
    <div class="header">
      <h2 class="title">Keyboard Shortcuts</h2>
      <button class="close-btn" onclick={onclose} aria-label="Close"><Icon name="x" /></button>
    </div>
    <div class="shortcut-list">
      {#each shortcuts as s}
        <div class="shortcut-row">
          <kbd class="key">{s.key}</kbd>
          <span class="label">{s.label}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed; inset: 0; z-index: var(--z-overlay);
    background: var(--color-overlay);
    display: flex; align-items: center; justify-content: center;
    animation: fade-in 0.15s ease;
  }
  .sheet {
    background: var(--color-surface);
    width: min(380px, 92vw);
    max-height: 80vh; overflow-y: auto;
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    box-shadow: var(--shadow-lg);
    animation: scale-in 0.15s ease;
  }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: var(--space-5);
  }
  .title {
    font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
    color: var(--color-text);
  }
  .close-btn {
    display: flex; align-items: center; justify-content: center;
    width: 2rem; height: 2rem; border-radius: var(--radius-md);
    color: var(--color-text-secondary);
  }
  .close-btn:hover { background: var(--color-bg-tertiary); }
  .shortcut-list {
    display: flex; flex-direction: column; gap: var(--space-2);
  }
  .shortcut-row {
    display: flex; align-items: center; gap: var(--space-3);
    padding: var(--space-2) 0;
    border-bottom: 0.5px solid var(--color-separator);
  }
  .shortcut-row:last-child { border-bottom: none; }
  .key {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 2rem; height: 1.75rem; padding: 0 0.5rem;
    border-radius: 0.25rem;
    background: var(--color-bg-tertiary);
    border: 1px solid var(--color-separator);
    font-family: var(--font-mono, monospace); font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold); color: var(--color-text);
    flex-shrink: 0;
  }
  .label {
    font-size: var(--font-size-base); color: var(--color-text-secondary);
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>
