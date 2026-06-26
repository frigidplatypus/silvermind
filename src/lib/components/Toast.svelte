<script lang="ts">
  import Icon from './Icon.svelte';
  import { registerToast } from '$lib/stores/toast.svelte';

  type ToastData = { id: number; message: string; type: 'error' | 'success' | 'undo'; onUndo?: () => void };

  let toasts = $state<ToastData[]>([]);
  let counter = 0;
  let timers = new Map<number, ReturnType<typeof setTimeout>>();

  export function showError(message: string) {
    const id = ++counter;
    toasts = [...toasts, { id, message, type: 'error' }];
    // Error toasts persist — user must dismiss manually
  }

  export function showSuccess(message: string) {
    const id = ++counter;
    toasts = [...toasts, { id, message, type: 'success' }];
    const t = setTimeout(() => dismiss(id), 3000);
    timers.set(id, t);
  }

  export function showUndo(message: string, onUndo: () => void) {
    const id = ++counter;
    toasts = [...toasts, { id, message, type: 'undo', onUndo }];
    const t = setTimeout(() => dismiss(id), 5000);
    timers.set(id, t);
  }

  registerToast({ showError, showSuccess, showUndo });

  function dismiss(id: number) {
    toasts = toasts.filter((t) => t.id !== id);
    const timer = timers.get(id);
    if (timer) { clearTimeout(timer); timers.delete(id); }
  }

  function handleUndo(toast: ToastData) {
    toast.onUndo?.();
    dismiss(toast.id);
  }
</script>

{#if toasts.length > 0}
  <div class="toast-container" role="region" aria-label="Notifications" aria-live="polite">
    {#each toasts as toast (toast.id)}
      <div class="toast" class:error={toast.type === 'error'} class:success={toast.type === 'success'} class:undo={toast.type === 'undo'} role={toast.type === 'error' ? 'alert' : 'status'}>
        <span class="toast-message">{toast.message}</span>
        {#if toast.type === 'undo'}
          <button class="undo-btn" onclick={() => handleUndo(toast)}>Undo</button>
        {:else}
          <button class="toast-dismiss" onclick={() => dismiss(toast.id)} aria-label="Dismiss"><Icon name="x" size="0.875rem" /></button>
        {/if}
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
  .toast.undo {
    background: var(--color-surface);
    color: var(--color-text);
    border: 1px solid var(--color-separator);
    padding: var(--space-2) var(--space-3);
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
  .undo-btn {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-accent);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    flex-shrink: 0;
  }
  .undo-btn:active { background: var(--color-accent-light); }
  @keyframes toast-in {
    from { opacity: 0; transform: translateY(0.5rem); }
    to { opacity: 1; transform: translateY(0); }
  }
</style>