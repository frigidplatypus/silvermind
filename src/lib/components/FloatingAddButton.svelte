<script lang="ts">
  import { addTask } from '$lib/stores/tasks.svelte';
  import { notifySuccess, notifyError } from '$lib/native/haptics';
  import { getAddTaskTrigger } from '$lib/stores/add-task.svelte';
  import { showError } from '$lib/stores/toast.svelte';
  import Icon from './Icon.svelte';

  let open = $state(false);
  let saving = $state(false);
  let inputValue = $state('');

  $effect(() => {
    if (getAddTaskTrigger() > 0) {
      trigger();
    }
  });

  async function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed || saving) return;
    saving = true;
    try {
      const task = await addTask(trimmed);
      if (task) {
        inputValue = '';
        open = false;
        notifySuccess();
      } else {
        notifyError();
        showError('Failed to add task');
      }
    } catch (e) {
      notifyError();
      showError(`Failed to add task: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      saving = false;
    }
  }

  function handleCancel() {
    inputValue = '';
    open = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); handleSubmit(); }
    else if (e.key === 'Escape') handleCancel();
  }

  function handleOverlayKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') handleCancel();
  }

  function handleOverlayClick() {
    if (!inputValue.trim()) handleCancel();
  }

  export function trigger() {
    open = true;
    setTimeout(() => document.getElementById('fab-input')?.focus(), 50);
  }
</script>

{#if open}
  <div class="fab-overlay" onclick={handleOverlayClick} onkeydown={handleOverlayKeydown} role="dialog" aria-modal="true" aria-label="Add task" tabindex="-1">
    <div class="fab-sheet" onclick={(e) => e.stopPropagation()} role="document">
      <form onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
        <div class="fab-input-row">
          <input
            id="fab-input"
            type="text"
            class="fab-input"
            placeholder="Add a task…"
            bind:value={inputValue}
            onkeydown={handleKeydown}
            autocomplete="off"
            enterkeyhint="done"
            aria-label="Task text"
          />
          <button type="button" class="fab-close-btn" onclick={handleCancel} aria-label="Cancel">
            <Icon name="x" size="1rem" />
          </button>
        </div>
        <button type="submit" class="fab-submit" disabled={!inputValue.trim() || saving}>
          {saving ? 'Adding…' : 'Add Task'}
        </button>
      </form>
    </div>
  </div>
{/if}

<button class="fab" onclick={() => trigger()} aria-label="Add task">
  <Icon name="plus" size="1.5rem" />
</button>

<style>
  .fab {
    position: fixed;
    bottom: calc(1.5rem + var(--safe-area-bottom, 0px));
    right: 1.5rem;
    width: 3.5rem;
    height: 3.5rem;
    border-radius: var(--radius-full);
    background: var(--color-accent);
    color: var(--color-on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: var(--shadow-fab);
    z-index: var(--z-dropdown);
    cursor: pointer;
    transition: transform var(--duration-normal) var(--easing), box-shadow var(--duration-normal) var(--easing);
  }
  .fab:hover {
    transform: scale(1.08);
    box-shadow: var(--shadow-lg);
  }
  .fab:active {
    transform: scale(0.95);
  }

  .fab-overlay {
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: var(--z-overlay);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    animation: fade-in var(--duration-normal) var(--easing);
  }
  .fab-sheet {
    width: 100%;
    max-width: 480px;
    background: var(--color-surface);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    padding: var(--space-4) var(--space-4) calc(var(--space-4) + var(--safe-area-bottom, 0px));
    box-shadow: var(--shadow-lg);
    animation: slide-up var(--duration-normal) var(--easing);
  }
  .fab-input-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .fab-input {
    flex: 1;
    padding: var(--space-3) 0.875rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    font-size: var(--font-size-base);
    color: var(--color-text);
    outline: none;
  }
  .fab-input:focus {
    border-color: var(--color-accent);
  }
  .fab-input::placeholder {
    color: var(--color-text-tertiary);
  }
  .fab-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--radius-full);
    color: var(--color-text-secondary);
    flex-shrink: 0;
  }
  .fab-close-btn:hover {
    background: var(--color-bg-tertiary);
  }
  .fab-submit {
    width: 100%;
    margin-top: var(--space-3);
    padding: var(--space-3);
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-base);
  }
  .fab-submit:disabled {
    opacity: 0.5;
  }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes slide-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
</style>