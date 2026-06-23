<script lang="ts">
  import Icon from './Icon.svelte';
  import { registerToast } from '$lib/stores/toast.svelte';

  let toasts = $state<{ id: number; message: string; type: 'error' | 'success' }[]>([]);
  let counter = 0;

  export function showError(message: string) {
    const id = ++counter;
    toasts = [...toasts, { id, message, type: 'error' }];
    setTimeout(() => dismiss(id), 5000);
  }

  export function showSuccess(message: string) {
    const id = ++counter;
    toasts = [...toasts, { id, message, type: 'success' }];
    setTimeout(() => dismiss(id), 3000);
  }

  registerToast({ showError, showSuccess });

  function dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
  }
</script>

{#if toasts.length > 0}
  <div class="toast-container" role="region" aria-label="Notifications" aria-live="polite">
    {#each toasts as toast (toast.id)}
      <div class="toast" class:error={toast.type === 'error'} class:success={toast.type === 'success'} role={toast.type === 'error' ? 'alert' : 'status'}>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-dismiss" onclick={() => dismiss(toast.id)} aria-label="Dismiss"><Icon name="x" size="0.875rem" /></button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .toast-container {
    position: fixed;
    bottom: calc(5rem + var(--safe-area-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    z-index: var(--z-toast);
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    pointer-events: none;
    width: max-content;
    max-width: 90vw;
  }
  .toast {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    pointer-events: auto;
    animation: toast-in 0.2s ease;
  }
  .toast.error {
    background: var(--color-danger);
    color: var(--color-on-danger);
  }
  .toast.success {
    background: var(--color-success);
    color: var(--color-on-accent);
  }
  .toast-message {
    flex: 1;
  }
  .toast-dismiss {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.125rem;
    border-radius: var(--radius-sm);
    color: inherit;
    opacity: 0.8;
    flex-shrink: 0;
  }
  .toast-dismiss:hover { opacity: 1; }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(0.5rem); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>