<script lang="ts">
  import { getServiceState } from '$lib/stores/service.svelte';
</script>

{#if getServiceState().state === 'unhealthy' || getServiceState().state === 'restarting'}
  <div class="service-banner" role="alert" aria-live="polite">
    <span class="banner-icon">⚠️</span>
    <span class="banner-text">
      {getServiceState().state === 'restarting'
        ? 'Reconnecting to task service…'
        : 'Task service unavailable'}
    </span>
  </div>
{/if}

<style>
  .service-banner { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 1rem; background: var(--color-warning-light); border-bottom: 1px solid var(--color-warning); font-size: var(--font-size-sm); color: var(--color-warning); flex-shrink: 0; }
  .banner-icon { flex-shrink: 0; }
  .banner-text { font-weight: 500; }
</style>
