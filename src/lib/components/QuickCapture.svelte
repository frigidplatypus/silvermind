<script lang="ts">
  import { addTask } from '$lib/stores/tasks.svelte';
  import { notifySuccess, notifyError } from '$lib/native/haptics';
  import Icon from './Icon.svelte';

  let inputValue = $state('');
  let isFocused = $state(false);

  async function handleSubmit() {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const task = await addTask(trimmed);
    if (task) {
      inputValue = '';
      isFocused = false;
      notifySuccess();
    } else {
      notifyError();
    }
  }

  function handleCancel() { inputValue = ''; isFocused = false; }
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    else if (e.key === 'Escape') handleCancel();
  }
</script>

<form class="capture-form" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
  <label for="quick-input" class="sr-only">Add a task</label>
  <input id="quick-input" type="text" class="capture-input" placeholder="Add a task…" bind:value={inputValue} onfocus={() => (isFocused = true)} onblur={() => { if (!inputValue.trim()) isFocused = false; }} onkeydown={handleKeydown} autocomplete="off" enterkeyhint="done" />
  {#if isFocused || inputValue.trim()}
    <button type="button" class="cancel-btn" onclick={handleCancel} aria-label="Clear"><Icon name="x" size="0.875rem" /></button>
    <button type="submit" class="submit-btn" disabled={!inputValue.trim()}>Save</button>
  {/if}
</form>

<style>
  .capture-form { display: flex; align-items: center; gap: 0.375rem; padding: 0.375rem 0; background: var(--color-bg); }
  .capture-input { flex: 1; padding: 0.375rem 0.625rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-bg-secondary); font-size: var(--font-size-sm); color: var(--color-text); outline: none; }
  .capture-input:focus { border-color: var(--color-accent); background: var(--color-surface); }
  .capture-input::placeholder { color: var(--color-text-tertiary); }
  .cancel-btn { padding: 0.25rem 0.375rem; color: var(--color-text-secondary); border-radius: var(--radius-sm); font-size: var(--font-size-sm); }
  .submit-btn { padding: 0.375rem 0.625rem; border-radius: var(--radius-sm); background: var(--color-accent); color: var(--color-on-accent); font-weight: var(--font-weight-semibold); font-size: var(--font-size-xs); }
  .submit-btn:disabled { opacity: 0.4; }
</style>
