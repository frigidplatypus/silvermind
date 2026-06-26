<script lang="ts">
  import { wasConsentShown, setCrashReporting } from '$lib/stores/privacy.svelte';
  import Icon from './Icon.svelte';

  let visible = $state(false);

  export function show() {
    if (wasConsentShown()) return;
    visible = true;
  }

  function enable() {
    setCrashReporting(true);
    visible = false;
  }

  function skip() {
    setCrashReporting(false);
    visible = false;
  }
</script>

{#if visible}
  <div class="overlay" role="dialog" aria-modal="true" aria-label="Crash reporting consent">
    <div class="sheet">
      <div class="icon-wrap">
        <Icon name="shield" size="2rem" />
      </div>
      <h2>Help Improve Silvermind</h2>
      <p class="body">
        Share anonymous crash reports to help us fix bugs faster.
        No personal data, task content, or page names are ever sent.
      </p>
      <p class="note">
        You can change this anytime in Settings.
      </p>
      <div class="actions">
        <button class="btn-primary" onclick={enable}>Enable</button>
        <button class="btn-secondary" onclick={skip}>Not Now</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed; inset: 0; z-index: var(--z-overlay);
    background: var(--color-overlay);
    display: flex; align-items: center; justify-content: center;
    padding: var(--space-4);
  }
  .sheet {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-6);
    max-width: 360px; width: 100%;
    text-align: center; box-shadow: var(--shadow-lg);
  }
  .icon-wrap {
    display: inline-flex; align-items: center; justify-content: center;
    width: 3.5rem; height: 3.5rem; border-radius: var(--radius-full);
    background: var(--color-accent-light); color: var(--color-accent);
    margin-bottom: var(--space-3);
  }
  h2 {
    font-size: var(--font-size-lg); font-weight: var(--font-weight-semibold);
    color: var(--color-text); margin-bottom: var(--space-2);
  }
  .body {
    font-size: var(--font-size-sm); color: var(--color-text-secondary);
    line-height: var(--line-height-relaxed); margin-bottom: var(--space-2);
  }
  .note {
    font-size: var(--font-size-xs); color: var(--color-text-tertiary);
    margin-bottom: var(--space-5);
  }
  .actions {
    display: flex; flex-direction: column; gap: var(--space-2);
  }
  .btn-primary {
    width: 100%; padding: var(--space-3); border-radius: var(--radius-md);
    background: var(--color-accent); color: var(--color-on-accent);
    font-weight: var(--font-weight-semibold); font-size: var(--font-size-base);
  }
  .btn-secondary {
    width: 100%; padding: var(--space-3); border-radius: var(--radius-md);
    background: var(--color-bg-tertiary); color: var(--color-text-secondary);
    font-weight: var(--font-weight-medium); font-size: var(--font-size-sm);
  }
</style>
