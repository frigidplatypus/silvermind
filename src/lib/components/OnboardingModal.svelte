<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import { getOnboardingStep, getSbtaskSpaces, startOnboarding, closeOnboarding } from '$lib/stores/onboarding.svelte';
  import { isDesktopApp, setSharedConfigDesktop, migrateSbtaskConfigDesktop, verifySpaceDesktop, addSpaceDesktop } from '$lib/desktop-bridge';
  import { addSpace, verifySpace } from '$lib/api/spaces';
  import { loadSpaces } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { deployHelpers } from '$lib/api/queries';

  let url = $state('');
  let name = $state('');
  let authToken = $state('');
  let showToken = $state(false);
  let verifying = $state(false);
  let verifyResult = $state<{ ok: boolean; task_count?: number; error?: string } | null>(null);
  let saving = $state(false);
  let error = $state('');

  onMount(() => {
    if (getOnboardingStep() !== 'migration') {
      url = '';
      name = '';
      authToken = '';
      verifyResult = null;
    }
  });

  function updateNameFromURL(value: string) {
    url = value;
    try {
      const host = new URL(value).hostname;
      name = host.split('.')[0];
    } catch {}
  }

  async function handleVerify() {
    if (!url.trim()) return;
    verifying = true;
    verifyResult = null;
    try {
      if (isDesktopApp()) {
        verifyResult = await verifySpaceDesktop(url.trim(), authToken || undefined);
      } else {
        const res = await verifySpace({ url: url.trim(), auth_token: authToken || undefined });
        verifyResult = { ok: res.ok, task_count: res.task_count, error: res.error };
      }
    } catch (e: any) {
      verifyResult = { ok: false, error: e?.error || e?.message || 'Verification failed' };
    } finally {
      verifying = false;
    }
  }

  async function handleSave() {
    if (!url.trim() || !name.trim()) return;
    saving = true;
    error = '';
    try {
      if (isDesktopApp()) {
        await addSpaceDesktop(name.trim(), url.trim(), 'Tasks', 'Inbox', authToken);
      } else {
        await addSpace({ name: name.trim(), url: url.trim(), auth_token: authToken || undefined });
      }
      await loadSpaces();
      deployHelpers().catch(() => {});
      loadInbox();
      closeOnboarding();
    } catch (e: any) {
      error = e?.error || e?.message || String(e);
    } finally {
      saving = false;
    }
  }

  async function handleUseSbtask() {
    saving = true;
    try {
      if (isDesktopApp()) {
        await setSharedConfigDesktop('');
        await loadSpaces();
        loadInbox();
        closeOnboarding();
      }
    } catch (e: any) {
      error = e?.error || e?.message || String(e);
    } finally {
      saving = false;
    }
  }

  async function handleCopy() {
    saving = true;
    try {
      if (isDesktopApp()) {
        await migrateSbtaskConfigDesktop();
        await loadSpaces();
        loadInbox();
        closeOnboarding();
      }
    } catch (e: any) {
      error = e?.error || e?.message || String(e);
    } finally {
      saving = false;
    }
  }

  const showMigrationOptions = $derived(isDesktopApp());
</script>

<div class="onboarding-overlay" role="dialog" aria-modal="true" aria-label="Silvermind Setup">
  <div class="onboarding-card">
    <div class="onboarding-header">
      <Icon name="layers" size="1.5rem" />
      <h1>Silvermind</h1>
    </div>

    {#if getOnboardingStep() === 'migration' && showMigrationOptions}
      <p class="onboarding-desc">Found existing sbtask configuration.</p>
      <div class="migration-spaces">
        {#each getSbtaskSpaces() as s}
          <div class="migration-space">
            <span class="migration-name">{s.name}</span>
            <span class="migration-url">{s.url}</span>
          </div>
        {/each}
      </div>
      <div class="onboarding-actions">
        <button class="btn btn-primary" onclick={handleUseSbtask} disabled={saving}>
          {saving ? 'Saving…' : 'Use sbtask config'}
        </button>
        <span class="action-hint">Keep both tools in sync</span>
      </div>
      <div class="onboarding-actions">
        <button class="btn btn-secondary" onclick={handleCopy} disabled={saving}>
          Copy to Silvermind
        </button>
        <span class="action-hint">One-time migration</span>
      </div>
      <div class="onboarding-actions">
        <button class="btn btn-ghost" onclick={() => startOnboarding('add-space')} disabled={saving}>
          Start fresh
        </button>
        <span class="action-hint">Skip and add spaces manually</span>
      </div>
    {:else if getOnboardingStep() === 'add-space' || (getOnboardingStep() === 'migration' && !showMigrationOptions)}
      <p class="onboarding-desc">Connect to your SilverBullet wiki to get started.</p>

      <div class="form-field">
        <label for="onboard-url">Space URL</label>
        <input id="onboard-url" type="text" bind:value={url} oninput={(e: any) => updateNameFromURL(e.target.value)} placeholder="https://notes.example.com" class="field-input" />
      </div>

      <div class="form-field">
        <label for="onboard-name">Name</label>
        <input id="onboard-name" type="text" bind:value={name} placeholder="notes" class="field-input" />
      </div>

      <div class="form-field">
        <label for="onboard-token">Auth Token (optional)</label>
        <div class="token-row">
          <input id="onboard-token" type={showToken ? 'text' : 'password'} bind:value={authToken} placeholder="silverbullet" class="field-input" />
          <button class="token-toggle" onclick={() => (showToken = !showToken)} aria-label="Toggle token visibility">
            <Icon name={showToken ? 'eye-off' : 'eye'} size="0.875rem" />
          </button>
        </div>
      </div>

      {#if verifyResult}
        <div class="verify-result" class:ok={verifyResult.ok} class:fail={!verifyResult.ok} role="status">
          {#if verifyResult.ok}
            <Icon name="check" size="0.875rem" /> Connected! Found {verifyResult.task_count} task{verifyResult.task_count === 1 ? '' : 's'}.
          {:else}
            <Icon name="x" size="0.875rem" /> {verifyResult.error}
          {/if}
        </div>
      {/if}

      {#if error}
        <div class="error-banner" role="alert">{error}</div>
      {/if}

      <div class="onboarding-actions">
        <button class="btn btn-secondary" onclick={handleVerify} disabled={verifying || !url.trim()}>
          {verifying ? 'Verifying…' : 'Verify Connection'}
        </button>
        <button class="btn btn-primary" onclick={handleSave} disabled={saving || !url.trim() || !name.trim()}>
          {saving ? 'Saving…' : 'Save & Continue'}
        </button>
      </div>
    {:else if getOnboardingStep() === 'saving'}
      <p class="onboarding-desc">Space connected! Loading your tasks...</p>
    {/if}
  </div>
</div>

<style>
  .onboarding-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0,0,0,0.5);
    padding: var(--space-4);
  }
  .onboarding-card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: 2rem;
    max-width: 440px;
    width: 100%;
    box-shadow: var(--shadow-lg);
  }
  .onboarding-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .onboarding-header h1 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }
  .onboarding-desc {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: 1.25rem;
  }
  .migration-spaces {
    margin-bottom: 1.25rem;
  }
  .migration-space {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0;
  }
  .migration-name {
    font-weight: var(--font-weight-semibold);
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }
  .migration-url {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
  }
  .form-field {
    margin-bottom: 0.75rem;
  }
  .form-field label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: 0.25rem;
  }
  .field-input {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }
  .token-row {
    display: flex;
    gap: 0.25rem;
  }
  .token-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 0.5rem;
    color: var(--color-text-tertiary);
    border-radius: var(--radius-md);
  }
  .token-toggle:hover { color: var(--color-text-secondary); }
  .verify-result {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    margin-bottom: 0.75rem;
  }
  .verify-result.ok { background: var(--color-accent-light); color: var(--color-accent); }
  .verify-result.fail { background: var(--color-danger-light); color: var(--color-danger); }
  .error-banner {
    padding: 0.5rem 0.625rem;
    background: var(--color-danger-light);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    margin-bottom: 0.75rem;
  }
  .onboarding-actions {
    display: flex;
    flex-direction: column;
    margin-top: 0.75rem;
  }
  .action-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: 0.125rem;
    padding-left: 0.125rem;
  }
  .btn {
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    text-align: center;
  }
  .btn:disabled { opacity: 0.5; cursor: default; }
  .btn-primary { background: var(--color-accent); color: var(--color-on-accent); }
  .btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
  .btn-secondary { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
  .btn-secondary:hover:not(:disabled) { background: var(--color-border); }
  .btn-ghost { background: transparent; color: var(--color-text-tertiary); }
  .btn-ghost:hover:not(:disabled) { color: var(--color-text-secondary); }
</style>

