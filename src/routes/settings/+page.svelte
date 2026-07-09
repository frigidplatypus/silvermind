<script lang="ts">
  import { getTheme, setTheme, getAccent, setAccent } from '$lib/stores/theme.svelte';
  import {
    getDefaultView,
    setDefaultView,
    getShowToday,
    setShowToday,
  } from '$lib/stores/landing.svelte';
  import { getSpacesList, loadSpaces, setActiveSpace } from '$lib/stores/space.svelte';
  import type { Mode } from '$lib/stores/theme.svelte';
  import type { AccentPreset } from '$lib/themes';
  import { presets } from '$lib/themes';
  import type { Space } from '$lib/types/space';
  import Icon from '$lib/components/Icon.svelte';
  import {
    isDesktopApp,
    addSpaceDesktop,
    removeSpaceDesktop,
    updateSpaceDesktop,
    verifySpaceDesktop,
  } from '$lib/desktop-bridge';
  import {
    addSpace,
    updateSpace,
    removeSpace,
    setActiveSpaceApi,
    verifySpace,
    getSpaceConfig,
    updateSpaceConfig,
    deploySpaceConfig,
  } from '$lib/api/spaces';
  import { showSuccess, showError } from '$lib/stores/toast.svelte';
  import { isCrashReportingEnabled, setCrashReporting } from '$lib/stores/privacy.svelte';
  import { downloadLogs } from '$lib/helpers/crash-reporting';
  import { deployHelpers } from '$lib/api/queries';
  import { devLog } from '$lib/helpers/dev-log';

  let currentTheme = $state<Mode>(getTheme());
  let currentAccent = $state<AccentPreset>(getAccent());
  let currentDefault = $state<string>(getDefaultView());
  let isDesktop = $state(false);
  let newName = $state('');
  let newUrl = $state('');
  let newInboxPage = $state('Inbox');
  let newDefaultExcludeTags = $state('');
  let newAuthToken = $state('');
  let saving = $state(false);
  let error = $state<string | null>(null);
  let editingSpace = $state<string | null>(null);
  let editName = $state('');
  let editUrl = $state('');
  let editInboxPage = $state('');
  let editInboxMode = $state('page');
  let editDefaultExcludeTags = $state('');
  let editAuthToken = $state('');
  let editSortBy = $state('due');
  let editSortOrder = $state('asc');
  let showEditToken = $state(false);
  let showNewToken = $state(false);
  let verifyingAdd = $state(false);
  let verifyAddResult = $state<{ ok: boolean; task_count?: number; error?: string } | null>(null);
  let verifyingEdit = $state(false);
  let verifyEditResult = $state<{ ok: boolean; task_count?: number; error?: string } | null>(null);

  async function handleVerifyNew() {
    if (!newUrl.trim()) return;
    verifyingAdd = true;
    verifyAddResult = null;
    try {
      if (isDesktop) {
        verifyAddResult = await verifySpaceDesktop(newUrl.trim(), newAuthToken || undefined);
      } else {
        const res = await verifySpace({
          url: newUrl.trim(),
          auth_token: newAuthToken || undefined,
        });
        verifyAddResult = { ok: res.ok, task_count: res.task_count, error: res.error };
      }
    } catch (e: any) {
      verifyAddResult = { ok: false, error: e?.error || e?.message || 'Verification failed' };
    } finally {
      verifyingAdd = false;
    }
  }

  async function handleVerifyEdit() {
    if (!editUrl.trim()) return;
    verifyingEdit = true;
    verifyEditResult = null;
    try {
      if (isDesktop) {
        verifyEditResult = await verifySpaceDesktop(editUrl.trim(), editAuthToken || undefined);
      } else {
        const res = await verifySpace({
          url: editUrl.trim(),
          auth_token: editAuthToken || undefined,
        });
        verifyEditResult = { ok: res.ok, task_count: res.task_count, error: res.error };
      }
    } catch (e: any) {
      verifyEditResult = { ok: false, error: e?.error || e?.message || 'Verification failed' };
    } finally {
      verifyingEdit = false;
    }
  }

  $effect(() => {
    isDesktop = isDesktopApp();
  });

  function onThemeChange(t: Mode) {
    currentTheme = t;
    setTheme(t);
  }
  function onAccentChange(a: AccentPreset) {
    currentAccent = a;
    setAccent(a);
  }
  function onDefaultChange(v: string) {
    currentDefault = v;
    setDefaultView(v);
  }
  function onShowTodayChange(show: boolean) {
    setShowToday(show);
    if (!show && currentDefault === 'today') {
      currentDefault = 'inbox';
      setDefaultView('inbox');
    }
  }

  function parseTags(value: string): string[] {
    return value
      .split(/[\s,]+/)
      .map((tag) => tag.trim().replace(/^#/, ''))
      .filter(Boolean);
  }

  async function startEdit(space: Space) {
    editingSpace = space.name;
    editName = space.name;
    editUrl = space.url;
    editAuthToken = '';
    showEditToken = false;
    try {
      const cfg = await getSpaceConfig();
      editInboxMode = cfg.inbox_mode || 'page';
      editInboxPage = cfg.inbox_page || 'Inbox';
      editDefaultExcludeTags = (cfg.exclude_tags || []).map((tag) => `#${tag}`).join(', ');
      editSortBy = cfg.default_sort_by || 'due';
      editSortOrder = cfg.default_sort_order || 'asc';
    } catch {
      editInboxMode = 'page';
      editInboxPage = 'Inbox';
      editDefaultExcludeTags = '';
      editSortBy = 'due';
      editSortOrder = 'asc';
    }
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
      if (isDesktop) {
        await updateSpaceDesktop(
          originalName,
          name !== originalName ? name : '',
          url,
          '',
          undefined,
          editAuthToken,
          undefined,
        );
      } else {
        await updateSpace(originalName, {
          name: name !== originalName ? name : undefined,
          url,
          auth_token: editAuthToken || undefined,
        });
      }
      await updateSpaceConfig({
        inbox_mode: editInboxMode || undefined,
        inbox_page: editInboxMode === 'page' ? editInboxPage || undefined : undefined,
        exclude_tags: parseTags(editDefaultExcludeTags),
        default_sort_by: editSortBy || undefined,
        default_sort_order: editSortOrder || undefined,
      });
      editingSpace = null;
      await loadSpaces();
      deployHelpers().catch(() => {});
      showSuccess('Space updated');
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      devLog('[silvermind] UpdateSpace failed:', msg, e);
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
      if (isDesktop) {
        await addSpaceDesktop(name, url, '', undefined, newAuthToken, undefined);
      } else {
        await addSpace({
          name,
          url,
          auth_token: newAuthToken || undefined,
        });
      }
      newName = '';
      newUrl = '';
      newInboxPage = 'Inbox';
      newDefaultExcludeTags = '';
      newAuthToken = '';
      await loadSpaces();
      deployHelpers().catch(() => {});
      showSuccess('Space added');
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      devLog('[silvermind] AddSpace failed:', msg, e);
      error = msg;
    } finally {
      saving = false;
    }
  }

  async function handleRemoveSpace(name: string) {
    saving = true;
    error = null;
    try {
      if (isDesktop) {
        await removeSpaceDesktop(name);
      } else {
        await removeSpace(name);
      }
      await loadSpaces();
      showSuccess('Space removed');
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      devLog('[silvermind] RemoveSpace failed:', msg, e);
      error = msg;
    } finally {
      saving = false;
    }
  }

  async function handleSetActive(name: string) {
    saving = true;
    error = null;
    try {
      if (!isDesktop) {
        await setActiveSpaceApi(name);
      }
      await setActiveSpace(name);
      await loadSpaces();
    } catch (e: any) {
      const msg = e?.error || e?.message || String(e);
      devLog('[silvermind] SetActiveSpace failed:', msg, e);
      error = msg;
    } finally {
      saving = false;
    }
  }
</script>

<div class="settings-page">
  <section class="section">
    <h3 class="section-title">Color Theme</h3>
    <div class="accent-picker">
      {#each presets as p}
        <button
          class="accent-btn"
          class:active={currentAccent === p.id}
          onclick={() => onAccentChange(p.id)}
          aria-label={p.label}
        >
          <span class="accent-swatch" style="background: {p.color}"></span>
          <span class="accent-label">{p.label}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="section">
    <h3 class="section-title">Appearance</h3>
    <div class="theme-picker">
      {#each ['system', 'light', 'dark'] as Mode[] as t}
        <button
          class="theme-btn"
          class:active={currentTheme === t}
          onclick={() => onThemeChange(t)}
        >
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
        {#if item.id !== 'today' || getShowToday()}
          <button
            class="default-btn"
            class:active={currentDefault === item.id}
            onclick={() => onDefaultChange(item.id)}
          >
            <Icon name={item.icon} size="1.5rem" />
            <span class="default-label">{item.label}</span>
          </button>
        {/if}
      {/each}
    </div>
  </section>

  <section class="section">
    <h3 class="section-title">Views</h3>
    <label class="toggle-row">
      <input
        type="checkbox"
        checked={getShowToday()}
        onchange={(e) => onShowTodayChange((e.target as HTMLInputElement).checked)}
      />
      <span>Show Today view</span>
    </label>
  </section>

  <section class="section">
    <h3 class="section-title">Privacy</h3>
    <label class="checkbox-item" style="margin-bottom:0.75rem">
      <input
        type="checkbox"
        checked={isCrashReportingEnabled()}
        onchange={(e) => setCrashReporting((e.target as HTMLInputElement).checked)}
      />
      <span>Share anonymous crash reports</span>
    </label>
    <p class="section-desc">
      Helps us fix bugs. No task content, page names, or personal data is ever sent.
    </p>
    <button class="btn btn-secondary" onclick={downloadLogs} style="margin-top:0.5rem"
      ><Icon name="download" size="0.875rem" /> Export diagnostic logs</button
    >
  </section>

  <section class="section">
    <h3 class="section-title">Spaces</h3>

    {#if error}
      <p class="error-msg">{error}</p>
    {/if}

    <div class="space-list">
      {#each getSpacesList() as space}
        <div class="space-item">
          {#if editingSpace === space.name}
            <div class="space-edit-form">
              <label class="field-label" for="edit-name-{space.name}">Name</label>
              <input
                id="edit-name-{space.name}"
                type="text"
                class="field"
                bind:value={editName}
                disabled={saving}
              />
              <label class="field-label" for="edit-url-{space.name}">URL</label>
              <input
                id="edit-url-{space.name}"
                type="text"
                class="field"
                bind:value={editUrl}
                disabled={saving}
              />
              <div style="display:flex;gap:0.5rem;margin-top:0.25rem">
                <button
                  class="verify-btn"
                  onclick={handleVerifyEdit}
                  disabled={verifyingEdit || !editUrl.trim()}
                  style="flex-shrink:0"
                >
                  {verifyingEdit ? 'Verifying…' : 'Verify'}
                </button>
                {#if verifyEditResult}
                  <span
                    class="verify-result"
                    class:ok={verifyEditResult.ok}
                    class:fail={!verifyEditResult.ok}
                  >
                    {verifyEditResult.ok
                      ? `✓ ${verifyEditResult.task_count} tasks`
                      : `✕ ${verifyEditResult.error}`}
                  </span>
                {/if}
              </div>
              <label class="field-label" for="edit-inbox-mode-{space.name}">Quick Add target</label>
              <div class="inbox-mode-picker">
                <label class="radio-row">
                  <input
                    type="radio"
                    name="inbox-mode-{space.name}"
                    value="page"
                    bind:group={editInboxMode}
                    disabled={saving}
                  />
                  <span>Use a specific page</span>
                </label>
                <input
                  id="edit-ip-{space.name}"
                  type="text"
                  class="field"
                  bind:value={editInboxPage}
                  placeholder="Inbox"
                  disabled={saving || editInboxMode !== 'page'}
                />
                <label class="radio-row">
                  <input
                    type="radio"
                    name="inbox-mode-{space.name}"
                    value="journal"
                    bind:group={editInboxMode}
                    disabled={saving}
                  />
                  <span>Use SilverBullet journal page (Journal/YYYY-MM-DD)</span>
                </label>
              </div>
              <label class="field-label" for="edit-exclude-tags-{space.name}">
                Exclude from default views
              </label>
              <input
                id="edit-exclude-tags-{space.name}"
                type="text"
                class="field"
                bind:value={editDefaultExcludeTags}
                placeholder="#shopping-list, #coram-deo"
                disabled={saving}
              />
              <p class="field-help">
                These tags are hidden from Task List, Today, and All Tasks. Custom queries can still
                use them.
              </p>
              <label class="field-label" for="edit-sort-{space.name}" style="margin-top:0.25rem">
                Default sort
              </label>
              <div style="display:flex;gap:0.5rem">
                <select
                  id="edit-sort-{space.name}"
                  class="field"
                  bind:value={editSortBy}
                  disabled={saving}
                >
                  <option value="due">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="page">Page</option>
                  <option value="name">Name</option>
                </select>
                <select class="field" bind:value={editSortOrder} disabled={saving}>
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
              <label class="field-label" for="edit-token-{space.name}" style="margin-top:0.25rem">
                Auth token
                <button
                  class="field-toggle"
                  onclick={() => (showEditToken = !showEditToken)}
                  type="button"
                  aria-label={showEditToken ? 'Hide token' : 'Show token'}
                >
                  <Icon name={showEditToken ? 'eye-off' : 'eye'} size="1rem" />
                </button>
              </label>
              <input
                id="edit-token-{space.name}"
                type={showEditToken ? 'text' : 'password'}
                class="field"
                bind:value={editAuthToken}
                placeholder="Leave empty to keep or clear"
                disabled={saving}
              />
              <div class="edit-actions">
                <button class="action-btn cancel" onclick={cancelEdit} disabled={saving}
                  >Cancel</button
                >
                <button
                  class="action-btn save"
                  onclick={() => handleEditSave(space.name)}
                  disabled={saving || !editName.trim() || !editUrl.trim()}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          {:else}
            <div class="space-info">
              <span class="space-name">{space.name}</span>
              <span class="space-url">{space.url}</span>
              <span class="space-meta">Config stored in <a href="https://silverbullet.md/Space%20Lua/Integrated%20Query" target="_blank" rel="noopener" class="help-link">Library/Silvermind/config</a></span>
            </div>
            <div class="space-actions">
              {#if !space.active}
                <button
                  class="action-btn set-active"
                  onclick={() => handleSetActive(space.name)}
                  aria-label="Set {space.name} as active space"
                >
                  <Icon name="check-circle" size="1rem" /> Set active
                </button>
              {:else}
                <span class="active-badge">Active</span>
              {/if}
              <button
                class="action-btn edit"
                onclick={() => startEdit(space)}
                aria-label="Edit space {space.name}"
              >
                <Icon name="edit-3" size="1rem" />
              </button>
              {#if getSpacesList().length > 1}
                <button
                  class="action-btn remove"
                  onclick={() => handleRemoveSpace(space.name)}
                  aria-label="Remove space {space.name}"
                >
                  <Icon name="trash-2" size="1rem" />
                </button>
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="add-space-form">
      <h4 class="form-title">Add Space</h4>
      <input
        type="text"
        class="field"
        placeholder="Space name"
        bind:value={newName}
        disabled={saving}
      />
      <input
        type="text"
        class="field"
        placeholder="Space URL"
        bind:value={newUrl}
        disabled={saving}
      />
      <div style="display:flex;gap:0.5rem;margin-top:0.25rem">
        <button
          class="verify-btn"
          onclick={handleVerifyNew}
          disabled={verifyingAdd || !newUrl.trim()}
          style="flex-shrink:0"
        >
          {verifyingAdd ? 'Verifying…' : 'Verify'}
        </button>
        {#if verifyAddResult}
          <span
            class="verify-result"
            class:ok={verifyAddResult.ok}
            class:fail={!verifyAddResult.ok}
          >
            {verifyAddResult.ok
              ? `✓ ${verifyAddResult.task_count} tasks`
              : `✕ ${verifyAddResult.error}`}
          </span>
        {/if}
      </div>
      <label class="field-label" style="margin-top:0.25rem">
        Auth token
        <button
          class="field-toggle"
          onclick={() => (showNewToken = !showNewToken)}
          type="button"
          aria-label={showNewToken ? 'Hide token' : 'Show token'}
        >
          <Icon name={showNewToken ? 'eye-off' : 'eye'} size="1rem" />
        </button>
      </label>
      <input
        type={showNewToken ? 'text' : 'password'}
        class="field"
        placeholder="Auth token (optional)"
        bind:value={newAuthToken}
        disabled={saving}
      />
      <button
        class="add-btn"
        onclick={handleAddSpace}
        disabled={saving || !newName.trim() || !newUrl.trim()}
      >
        {saving ? 'Adding…' : 'Add Space'}
      </button>
    </div>
  </section>

  <section class="section">
    <h3 class="section-title">About</h3>
    <p class="about-text">Silvermind &mdash; task management powered by SilverBullet.</p>
  </section>
</div>

<style>
  .settings-page {
    padding: var(--space-4);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .section {
    margin-bottom: 2rem;
  }
  .section-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
    margin-bottom: 0.75rem;
  }
  .section-desc {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
    margin-bottom: 0.75rem;
  }
  .error-msg {
    font-size: var(--font-size-sm);
    color: var(--color-danger);
    margin-bottom: 0.5rem;
  }
  .accent-picker {
    display: flex;
    gap: 0.375rem;
    flex-wrap: wrap;
  }
  .accent-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    flex: 1;
    min-width: 3rem;
    padding: 0.625rem 0.25rem;
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
    border: 2px solid transparent;
    cursor: pointer;
  }
  .accent-btn.active {
    border-color: var(--color-accent);
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
  .accent-swatch {
    display: block;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--color-bg);
  }
  .accent-label {
    font-weight: 500;
    margin-top: 0.125rem;
  }
  .theme-picker {
    display: flex;
    gap: 0.5rem;
  }
  .theme-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    padding: 0.75rem 0.25rem;
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    border: 2px solid transparent;
  }
  .theme-btn.active {
    border-color: var(--color-accent);
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
  .theme-label {
    font-weight: 500;
  }
  .default-picker {
    display: flex;
    gap: 0.5rem;
  }
  .default-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.25rem;
    flex: 1;
    padding: 0.75rem 0.25rem;
    border-radius: var(--radius-lg);
    background: var(--color-bg-secondary);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    border: 2px solid transparent;
    cursor: pointer;
  }
  .default-btn.active {
    border-color: var(--color-accent);
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
  .default-label {
    font-weight: 500;
  }
  .space-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .space-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    gap: 0.75rem;
  }
  .space-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    flex: 1;
    min-width: 0;
  }
  .space-name {
    font-size: var(--font-size-base);
    font-weight: 500;
  }
  .space-url {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    max-width: 200px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .space-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.625rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-xs);
    font-weight: 500;
  }
  .action-btn.set-active {
    color: var(--color-accent);
    background: var(--color-accent-light);
  }
  .action-btn.edit {
    color: var(--color-accent);
    background: var(--color-accent-light);
    padding: 0.375rem;
  }
  .action-btn.remove {
    color: var(--color-danger);
    background: var(--color-danger-light);
    padding: 0.375rem;
  }
  .action-btn.cancel {
    color: var(--color-text-secondary);
    background: var(--color-bg-tertiary);
  }
  .action-btn.save {
    color: var(--color-on-accent);
    background: var(--color-accent);
  }
  .action-btn.save:disabled {
    opacity: 0.4;
  }
  .active-badge {
    font-size: var(--font-size-xs);
    padding: 0.125rem 0.5rem;
    border-radius: var(--radius-sm);
    background: var(--color-success-light);
    color: var(--color-success);
    font-weight: 600;
  }
  .space-edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
  }
  .field-label {
    font-size: var(--font-size-xs);
    font-weight: 600;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .field-help {
    margin: -0.25rem 0 0.25rem;
    font-size: var(--font-size-xs);
    line-height: 1.35;
    color: var(--color-text-tertiary);
  }
  .edit-actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }
  .add-space-form {
    margin-top: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 1rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
  }
  .form-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--color-text);
  }
  .field {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    outline: none;
    font-family: inherit;
  }
  .field:focus {
    border-color: var(--color-accent);
  }
  .add-btn {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
  }
  .add-btn:disabled {
    opacity: 0.4;
  }
  .verify-btn {
    padding: 0.375rem 0.75rem;
    border-radius: var(--radius-md);
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
  }
  .verify-btn:hover:not(:disabled) {
    background: var(--color-border);
  }
  .verify-btn:disabled {
    opacity: 0.4;
  }
  .verify-result {
    font-size: var(--font-size-xs);
    line-height: 1.5;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .verify-result.ok {
    color: var(--color-accent);
  }
  .verify-result.fail {
    color: var(--color-danger);
  }
  .field-toggle {
    background: none;
    border: none;
    color: var(--color-text-tertiary);
    cursor: pointer;
    padding: 0;
    display: inline-flex;
    align-items: center;
    margin-left: 0.25rem;
  }
  .field-toggle:hover {
    color: var(--color-text-secondary);
  }
  .about-text {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }
  .toggle-row input {
    accent-color: var(--color-accent);
  }
  .inbox-mode-picker {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .radio-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    cursor: pointer;
  }
  .help-link {
    color: var(--color-text-tertiary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .help-link:hover {
    color: var(--color-accent);
  }
  .radio-row input {
    accent-color: var(--color-accent);
  }
</style>
