<script lang="ts">
  import { getServiceState } from '$lib/stores/service.svelte';
  import Icon from './Icon.svelte';

  const s = $derived(getServiceState());
  const show = $derived(s.state === 'unhealthy' || s.state === 'restarting' || s.state === 'failed');

  function retry() {
    window.location.reload();
  }
</script>

{#if show}
  <div class="service-banner" role="alert" aria-live="polite">
    <Icon name="alert-triangle" size="1rem" />
    <span class="banner-text">
      {s.state === 'restarting'
        ? 'Reconnecting to task service…'
        : s.state === 'failed'
          ? 'Task service unavailable'
          : 'Task service unavailable'}
    </span>
    {#if s.state === 'failed'}
      <button class="retry-btn" onclick={retry}>Reload app</button>
    {/if}
    {#if s.lastError}
      <span class="banner-detail">{s.lastError}</span>
    {/if}
  </div>
{/if}

<style>
  .service-banner { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-warning-light); border-bottom: 1px solid var(--color-warning); font-size: var(--font-size-sm); color: var(--color-warning); flex-shrink: 0; }
  .banner-text { font-weight: var(--font-weight-medium); }
  .banner-detail { font-size: var(--font-size-xs); opacity: 0.8; width: 100%; }
  .retry-btn { margin-left: auto; padding: 0.125rem 0.75rem; border-radius: var(--radius-sm); background: var(--color-warning); color: var(--color-on-warning); font-size: var(--font-size-xs); font-weight: var(--font-weight-semibold); }
</style>
