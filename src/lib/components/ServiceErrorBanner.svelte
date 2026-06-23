<script lang="ts">
  import { getServiceState } from '$lib/stores/service.svelte';
  import Icon from './Icon.svelte';
</script>

{#if getServiceState().state === 'unhealthy' || getServiceState().state === 'restarting'}
  <div class="service-banner" role="alert" aria-live="polite">
    <Icon name="alert-triangle" size="1rem" />
    <span class="banner-text">
      {getServiceState().state === 'restarting'
        ? 'Reconnecting to task service…'
        : 'Task service unavailable'}
    </span>
  </div>
{/if}

<style>
  .service-banner { display: flex; align-items: center; gap: var(--space-2); padding: var(--space-2) var(--space-4); background: var(--color-warning-light); border-bottom: 1px solid var(--color-warning); font-size: var(--font-size-sm); color: var(--color-warning); flex-shrink: 0; }
  .banner-text { font-weight: var(--font-weight-medium); }
</style>
