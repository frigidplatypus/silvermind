<script lang="ts">
  import { getTheme, setTheme } from '$lib/stores/theme.svelte';
  import { getSpacesList, loadSpaces, setActiveSpace } from '$lib/stores/space.svelte';
  import type { Theme } from '$lib/stores/theme.svelte';
  import Icon from '$lib/components/Icon.svelte';
  import { isDesktopApp, addSpaceDesktop, removeSpaceDesktop, setActiveSpaceDesktop } from '$lib/desktop-bridge';

  let currentTheme = $state<Theme>(getTheme());
  let isDesktop = $state(false);
  let newName = $state('');
  let newUrl = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    isDesktop = isDesktopApp();
  });

  function onThemeChange(t: Theme) { currentTheme = t; setTheme(t); }

  async function handleAddSpace() {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !url) return;
    saving = true;
    error = null;
    try {
      await addSpaceDesktop(name, url);
      newName = '';
      newUrl = '';
      await loadSpaces();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to add space';
    } finally {
      saving = false;
    }
  }

  async function handleRemoveSpace(name: string) {
    saving = true;
    error = null;
    try {
      await removeSpaceDesktop(name);
      await loadSpaces();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to remove space';
    } finally {
      saving = false;
    }
  }

  async function handleSetActive(name: string) {
    if (isDesktop) {
      try {
        await setActiveSpaceDesktop(name);
        await loadSpaces();
      } catch (e) {
        error = e instanceof Error ? e.message : 'Failed to set active space';
      }
    } else {
      await setActiveSpace(name);
    }
  }
</script>

<div class="settings-page">
  <h2 class="page-title">Settings</h2>

  <section class="section">
    <h3 class="section-title">Appearance</h3>
    <div class="theme-picker">
      {#each (['system', 'light', 'dark'] as Theme[]) as t}
        <button class="theme-btn" class:active={currentTheme === t} onclick={() => onThemeChange(t)}>
          <Icon name={t === 'system' ? 'monitor' : t === 'light' ? 'sun' : 'moon'} size="1.5rem" />
          <span class="theme-label">{t.charAt(0).toUpperCase() + t.slice(1)}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="section">
    <h3 class="section-title">Spaces</h3>

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}

    <div class="space-list">
      {#each getSpacesList() as space}
        <div class="space-item">
          <div class="space-info">
            <span class="space-name">{space.name}</span>
            <span class="space-url">{space.url}</span>
          </div>
          <div class="space-actions">
            {#if !space.active}
              <button class="action-btn set-active" onclick={() => handleSetActive(space.id)} aria-label="Set {space.name} as active space">
                <Icon name="check-circle" size="1rem" /> Set active
              </button>
            {:else}
              <span class="active-badge">Active</span>
            {/if}
            {#if isDesktop && getSpacesList().length > 1}
              <button class="action-btn remove" onclick={() => handleRemoveSpace(space.name)} aria-label="Remove space {space.name}">
                <Icon name="trash-2" size="1rem" />
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if isDesktop}
      <div class="add-space-form">
        <h4 class="form-title">Add Space</h4>
        <input type="text" class="field" placeholder="Space name" bind:value={newName} disabled={saving} />
        <input type="text" class="field" placeholder="Taskd URL" bind:value={newUrl} disabled={saving} />
        <button class="add-btn" onclick={handleAddSpace} disabled={saving || !newName.trim() || !newUrl.trim()}>
          {saving ? 'Adding…' : 'Add Space'}
        </button>
      </div>
    {:else}
      <p class="section-desc">Spaces are configured in your sbtask config file (~/.config/sbtask/config.yaml). Changes there will appear here after a restart.</p>
    {/if}
  </section>

  <section class="section">
    <h3 class="section-title">About</h3>
    <p class="about-text">Silvermind &mdash; task management powered by sbtask.</p>
  </section>
</div>

<style>
  .settings-page { padding: 1rem; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .page-title { font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: 1.5rem; }
  .section { margin-bottom: 2rem; }
  .section-title { font-size: var(--font-size-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-secondary); margin-bottom: 0.75rem; }
  .section-desc { font-size: var(--font-size-sm); color: var(--color-text-tertiary); margin-bottom: 0.75rem; }
  .error-msg { font-size: var(--font-size-sm); color: var(--color-danger); margin-bottom: 0.5rem; }
  .theme-picker { display: flex; gap: 0.5rem; }
  .theme-btn { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex: 1; padding: 0.75rem 0.25rem; border-radius: var(--radius-lg); background: var(--color-bg-secondary); font-size: var(--font-size-sm); color: var(--color-text-secondary); border: 2px solid transparent; }
  .theme-btn i { font-size: 1.5rem; }
  .theme-btn.active { border-color: var(--color-accent); background: var(--color-accent-light); color: var(--color-accent); }
  .theme-label { font-weight: 500; }
  .space-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .space-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: var(--radius-md); background: var(--color-bg-secondary); gap: 0.75rem; }
  .space-info { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0; }
  .space-name { font-size: var(--font-size-base); font-weight: 500; }
  .space-url { font-size: var(--font-size-xs); color: var(--color-text-tertiary); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .space-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .action-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.625rem; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 500; }
  .action-btn.set-active { color: var(--color-accent); background: var(--color-accent-light); }
  .action-btn.remove { color: var(--color-danger); background: var(--color-danger-light); padding: 0.375rem; }
  .active-badge { font-size: var(--font-size-xs); padding: 0.125rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-success-light); color: var(--color-success); font-weight: 600; }
  .add-space-form { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-radius: var(--radius-md); background: var(--color-bg-secondary); }
  .form-title { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); }
  .field { width: 100%; padding: 0.5rem 0.625rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font-size: var(--font-size-sm); color: var(--color-text); outline: none; font-family: inherit; }
  .field:focus { border-color: var(--color-accent); }
  .add-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-accent); color: white; font-weight: 600; font-size: var(--font-size-sm); }
  .add-btn:disabled { opacity: 0.4; }
  .about-text { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }
</style>
