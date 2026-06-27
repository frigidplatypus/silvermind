<script lang="ts">
  import { loadQueryPages, getQueryPagesList, getQueryPagesLoading, getQueryPagesError } from '$lib/stores/queries.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let { onNavigate }: { onNavigate: (tab: string) => void } = $props();
  let refreshing = $state(false);

  async function handleRefresh() {
    refreshing = true;
    try { await loadQueryPages(true); } finally { refreshing = false; }
  }

  function handleQueryClick(page: string, blockNumber?: number) {
    if (blockNumber) {
      onNavigate(`queries:${page}:${blockNumber}`);
    } else {
      onNavigate(`queries:${page}`);
    }
  }
</script>

<div class="queries-page">
  <div class="queries-header">
    <h3 class="section-title">Saved Queries</h3>
    <div class="header-actions">
      <button class="action-btn" onclick={handleRefresh} disabled={refreshing} aria-label="Refresh queries">
        <Icon name="rotate-cw" size="1rem" />
      </button>
      <button class="action-btn primary" onclick={() => onNavigate('builder')} aria-label="New query">
        <Icon name="plus" size="1rem" />
      </button>
    </div>
  </div>

  {#if getQueryPagesLoading()}
    <div class="state-message">Loading queries...</div>
  {:else if getQueryPagesError()}
    <div class="state-message error">{getQueryPagesError()}</div>
  {:else if getQueryPagesList().length === 0}
    <div class="state-message empty">
      <p>No queries yet.</p>
      <p class="hint">Create one with the <span class="key-hint">+</span> button above.</p>
    </div>
  {:else}
    <div class="query-list">
      {#each getQueryPagesList() as qp}
        {#if qp.blocks.length === 1}
          <button class="query-item" onclick={() => handleQueryClick(qp.page, qp.blocks[0].number)}>
            <div class="query-item-icon"><Icon name="file-text" size="1rem" /></div>
            <div class="query-item-content">
              <span class="query-item-title">{qp.blocks[0].title}</span>
              <span class="query-item-page">{qp.page.startsWith('queries/') ? qp.page.slice(8) : qp.page}</span>
            </div>
            {#if qp.errors && qp.errors.length > 0}
              <Icon name="alert-triangle" size="0.875rem" />
            {/if}
            <Icon name="chevron-right" size="0.875rem" />
          </button>
        {:else}
          <div class="query-group">
            <div class="query-group-header">
              <Icon name="folder" size="1rem" />
              <span>{qp.page.startsWith('queries/') ? qp.page.slice(8) : qp.page}</span>
              {#if qp.errors && qp.errors.length > 0}
                <Icon name="alert-triangle" size="0.875rem" />
              {/if}
            </div>
            {#each qp.blocks as block}
              <button class="query-item child" onclick={() => handleQueryClick(qp.page, block.number)}>
                <div class="query-item-icon"><Icon name="chevron-right" size="0.75rem" /></div>
                <div class="query-item-content">
                  <span class="query-item-title">{block.title}</span>
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .queries-page {
    padding: var(--space-4);
    overflow-y: auto;
  }
  .queries-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }
  .section-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
  }
  .header-actions {
    display: flex;
    gap: 0.25rem;
  }
  .action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
  }
  .action-btn:hover { background: var(--color-bg-tertiary); color: var(--color-text); }
  .action-btn.primary { color: var(--color-accent); }
  .action-btn:disabled { opacity: 0.4; }
  .state-message {
    padding: 2rem var(--space-4);
    text-align: center;
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }
  .state-message.error { color: var(--color-danger); }
  .state-message.empty p { margin: 0 0 0.25rem; }
  .state-message .hint { color: var(--color-text-tertiary); font-size: var(--font-size-xs); }
  .key-hint {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: var(--color-bg-tertiary);
    border-radius: var(--radius-sm);
    padding: 0 0.25rem;
    min-width: 1.25rem;
    height: 1.25rem;
    font-size: var(--font-size-xs);
    vertical-align: middle;
  }
  .query-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .query-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    border-radius: var(--radius-md);
    width: 100%;
    text-align: left;
    color: var(--color-text);
  }
  .query-item:active { background: var(--color-bg-tertiary); }
  .query-item.child { padding-left: 2rem; }
  .query-item-icon {
    flex-shrink: 0;
    color: var(--color-text-tertiary);
    display: flex;
  }
  .query-item-content {
    flex: 1;
    min-width: 0;
  }
  .query-item-title {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .query-item-page {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .query-group {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    overflow: hidden;
  }
  .query-group-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--color-bg-secondary);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    border-bottom: 1px solid var(--color-border);
  }
  .query-group .query-item {
    border-top: 1px solid var(--color-separator);
    border-radius: 0;
  }
  .query-group .query-item:first-child { border-top: none; }
</style>
