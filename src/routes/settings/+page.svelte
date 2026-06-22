<script lang="ts">
  import { getTheme, setTheme } from '$lib/stores/theme.svelte';
  import { getDefaultView, setDefaultView, getShowToday, setShowToday } from '$lib/stores/landing.svelte';
  import { getSpacesList, loadSpaces, setActiveSpace } from '$lib/stores/space.svelte';
  import type { Theme } from '$lib/stores/theme.svelte';
  import type { Space } from '$lib/types/space';
  import Icon from '$lib/components/Icon.svelte';
  import { isDesktopApp, addSpaceDesktop, removeSpaceDesktop, setActiveSpaceDesktop, updateSpaceDesktop } from '$lib/desktop-bridge';

  let currentTheme = $state<Theme>(getTheme());
  let currentDefault = $state<string>(getDefaultView());
  let isDesktop = $state(false);
  let newName = $state('');
  let newUrl = $state('');
  let newAuthToken = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);
  let editingSpace = $state<string | null>(null);
  let editName = $state('');
  let editUrl = $state('');
  let editDefaultPage = $state('');
  let editInboxPage = $state('');
  let editAuthToken = $state('');
  let showEditToken = $state(false);
  let showNewToken = $state(false);

  $effect(() => {
    isDesktop = isDesktopApp();
  });

  function onThemeChange(t: Theme) { currentTheme = t; setTheme(t); }
  function onDefaultChange(v: string) { currentDefault = v; setDefaultView(v); }

  function startEdit(space: Space) {
    editingSpace = space.name;
    editName = space.name;
    editUrl = space.url;
    editDefaultPage = '';
    editInboxPage = '';
    editAuthToken = '';
    showEditToken = false;
  }

  function cancelEdit() {
    editingSpace = null;
  }

  async function handleEditSave(originalName: string) {
    const name = editName.trim();
    const url = editUrl.trim();
    if (!name || !url) return;
    saving = true;
    error = null;
    try {
      await updateSpaceDesktop(originalName, name !== originalName ? name : '', url, editDefaultPage, editInboxPage, editAuthToken);
      editingSpace = null;
      await loadSpaces();
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      console.error('[silvermind] UpdateSpace failed:', msg, e);
      error = msg;
    } finally {
      saving = false;
    }
  }

  async function handleAddSpace() {
    const name = newName.trim();
    const url = newUrl.trim();
    if (!name || !url) return;
    saving = true;
    error = null;
    try {
      await addSpaceDesktop(name, url, '', '', newAuthToken);
      newName = '';
      newUrl = '';
      newAuthToken = '';
      await loadSpaces();
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      console.error('[silvermind] AddSpace failed:', msg, e);
      error = msg;
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
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      console.error('[silvermind] RemoveSpace failed:', msg, e);
      error = msg;
    } finally {
      saving = false;
    }
  }

  async function handleSetActive(name: string) {
    if (isDesktop) {
      try {
        await setActiveSpaceDesktop(name);
        setActiveSpace(name);
        await loadSpaces();
      } catch (e: any) {
        const msg = e?.error || e?.message || String(e);
        console.error('[silvermind] SetActiveSpace failed:', msg, e);
        error = msg;
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
    <h3 class="section-title">Startup</h3>
    <div class="default-picker">
      {#each [{ id: 'inbox', icon: 'inbox', label: 'Task List' }, { id: 'today', icon: 'calendar', label: 'Today' }, { id: 'global', icon: 'globe', label: 'All Tasks' }] as item}
        <button class="default-btn" class:active={currentDefault === item.id} onclick={() => onDefaultChange(item.id)}>
          <Icon name={item.icon} size="1.5rem" />
          <span class="default-label">{item.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="section">
    <h3 class="section-title">Views</h3>
    <label class="toggle-row">
      <input type="checkbox" checked={getShowToday()} onchange={(e) => setShowToday((e.target as HTMLInputElement).checked)} />
      <span>Show Today view</span>
    </label>
  </section>

  <section class="section">
    <h3 class="section-title">Spaces</h3>

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}

    <div class="space-list">
      {#each getSpacesList() as space}
        <div class="space-item">
          {#if isDesktop && editingSpace === space.name}
            <div class="space-edit-form">
              <label class="field-label" for="edit-name-{space.name}">Name</label>
              <input id="edit-name-{space.name}" type="text" class="field" bind:value={editName} disabled={saving} />
              <label class="field-label" for="edit-url-{space.name}">URL</label>
              <input id="edit-url-{space.name}" type="text" class="field" bind:value={editUrl} disabled={saving} />
              <label class="field-label" for="edit-dp-{space.name}">Default page</label>
              <input id="edit-dp-{space.name}" type="text" class="field" bind:value={editDefaultPage} placeholder="Tasks" disabled={saving} />
              <label class="field-label" for="edit-ip-{space.name}">Inbox page</label>
              <input id="edit-ip-{space.name}" type="text" class="field" bind:value={editInboxPage} placeholder="Inbox" disabled={saving} />
              <label class="field-label" for="edit-token-{space.name}" style="margin-top:0.25rem">
                Auth token
                <button class="field-toggle" onclick={() => (showEditToken = !showEditToken)} type="button" aria-label={showEditToken ? 'Hide token' : 'Show token'}>
                  <Icon name={showEditToken ? 'eye-off' : 'eye'} size="1rem" />
                </button>
              </label>
              <input id="edit-token-{space.name}" type={showEditToken ? 'text' : 'password'} class="field" bind:value={editAuthToken} placeholder="Leave empty to keep or clear" disabled={saving} />
              <div class="edit-actions">
                <button class="action-btn cancel" onclick={cancelEdit} disabled={saving}>Cancel</button>
                <button class="action-btn save" onclick={() => handleEditSave(space.name)} disabled={saving || !editName.trim() || !editUrl.trim()}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          {:else}
            <div class="space-info">
              <span class="space-name">{space.name}</span>
              <span class="space-url">{space.url}</span>
            </div>
            <div class="space-actions">
              {#if !space.active}
                <button class="action-btn set-active" onclick={() => handleSetActive(space.name)} aria-label="Set {space.name} as active space">
                  <Icon name="check-circle" size="1rem" /> Set active
                </button>
              {:else}
                <span class="active-badge">Active</span>
              {/if}
              {#if isDesktop}
                <button class="action-btn edit" onclick={() => startEdit(space)} aria-label="Edit space {space.name}">
                  <Icon name="edit-3" size="1rem" />
                </button>
                {#if getSpacesList().length > 1}
                  <button class="action-btn remove" onclick={() => handleRemoveSpace(space.name)} aria-label="Remove space {space.name}">
                    <Icon name="trash-2" size="1rem" />
                  </button>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if isDesktop}
      <div class="add-space-form">
        <h4 class="form-title">Add Space</h4>
        <input type="text" class="field" placeholder="Space name" bind:value={newName} disabled={saving} />
        <input type="text" class="field" placeholder="Space URL" bind:value={newUrl} disabled={saving} />
        <label class="field-label" style="margin-top:0.25rem">
          Auth token
          <button class="field-toggle" onclick={() => (showNewToken = !showNewToken)} type="button" aria-label={showNewToken ? 'Hide token' : 'Show token'}>
            <Icon name={showNewToken ? 'eye-off' : 'eye'} size="1rem" />
          </button>
        </label>
        <input type={showNewToken ? 'text' : 'password'} class="field" placeholder="Auth token (optional)" bind:value={newAuthToken} disabled={saving} />
        <button class="add-btn" onclick={handleAddSpace} disabled={saving || !newName.trim() || !newUrl.trim()}>
          {saving ? 'Adding…' : 'Add Space'}
        </button>
      </div>
    {:else}
      <p class="section-desc">Spaces are configured in your Silvermind config file (~/.config/silvermind/config.yaml).</p>
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
  .default-picker { display: flex; gap: 0.5rem; }
  .default-btn { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex: 1; padding: 0.75rem 0.25rem; border-radius: var(--radius-lg); background: var(--color-bg-secondary); font-size: var(--font-size-sm); color: var(--color-text-secondary); border: 2px solid transparent; cursor: pointer; }
  .default-btn.active { border-color: var(--color-accent); background: var(--color-accent-light); color: var(--color-accent); }
  .default-label { font-weight: 500; }
  .space-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .space-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: var(--radius-md); background: var(--color-bg-secondary); gap: 0.75rem; }
  .space-info { display: flex; flex-direction: column; gap: 0.125rem; flex: 1; min-width: 0; }
  .space-name { font-size: var(--font-size-base); font-weight: 500; }
  .space-url { font-size: var(--font-size-xs); color: var(--color-text-tertiary); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .space-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
  .action-btn { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.375rem 0.625rem; border-radius: var(--radius-md); font-size: var(--font-size-xs); font-weight: 500; }
  .action-btn.set-active { color: var(--color-accent); background: var(--color-accent-light); }
  .action-btn.edit { color: var(--color-accent); background: var(--color-accent-light); padding: 0.375rem; }
  .action-btn.remove { color: var(--color-danger); background: var(--color-danger-light); padding: 0.375rem; }
  .action-btn.cancel { color: var(--color-text-secondary); background: var(--color-bg-tertiary); }
  .action-btn.save { color: #fff; background: var(--color-accent); }
  .action-btn.save:disabled { opacity: 0.4; }
  .active-badge { font-size: var(--font-size-xs); padding: 0.125rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-success-light); color: var(--color-success); font-weight: 600; }
  .space-edit-form { display: flex; flex-direction: column; gap: 0.5rem; width: 100%; }
  .field-label { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; }
  .edit-actions { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.25rem; }
  .add-space-form { margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; border-radius: var(--radius-md); background: var(--color-bg-secondary); }
  .form-title { font-size: var(--font-size-sm); font-weight: 600; color: var(--color-text); }
  .field { width: 100%; padding: 0.5rem 0.625rem; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); font-size: var(--font-size-sm); color: var(--color-text); outline: none; font-family: inherit; }
  .field:focus { border-color: var(--color-accent); }
  .add-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); background: var(--color-accent); color: white; font-weight: 600; font-size: var(--font-size-sm); }
  .add-btn:disabled { opacity: 0.4; }
  .field-toggle { background: none; border: none; color: var(--color-text-tertiary); cursor: pointer; padding: 0; display: inline-flex; align-items: center; margin-left: 0.25rem; }
  .field-toggle:hover { color: var(--color-text-secondary); }
  .about-text { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }
  .toggle-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0; font-size: var(--font-size-sm); color: var(--color-text-secondary); cursor: pointer; }
  .toggle-row input { accent-color: var(--color-accent); }
</style>
