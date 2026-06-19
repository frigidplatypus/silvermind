<script lang="ts">
  import Icon from './Icon.svelte';

  let {
    activeView,
    onNavigate,
  }: {
    activeView: 'inbox' | 'today' | 'settings';
    onNavigate: (view: string) => void;
  } = $props();

  const items = $derived([
    { id: 'inbox', label: 'Inbox', icon: 'inbox' },
    { id: 'today', label: 'Today', icon: 'calendar' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
  ]);
</script>

<nav class="sidebar" role="navigation" aria-label="Main navigation">
  <div class="sidebar-brand">🐾 Prowl</div>
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
  }
  .sidebar-brand {
    font-size: var(--font-size-lg);
    font-weight: 700;
    color: var(--color-text);
    padding: 0.5rem 0.75rem 1rem;
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
</style>
