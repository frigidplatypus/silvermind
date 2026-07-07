<script lang="ts">
  import { onMount } from 'svelte';
  import Icon from './Icon.svelte';
  import LogoSvg from './LogoSvg.svelte';
  import { getOnboardingStep, goToStep, closeOnboarding } from '$lib/stores/onboarding.svelte';
  import { isDesktopApp, verifySpaceDesktop, addSpaceDesktop } from '$lib/desktop-bridge';
  import { addSpace, verifySpace } from '$lib/api/spaces';
  import { loadSpaces } from '$lib/stores/space.svelte';
  import { loadInbox } from '$lib/stores/tasks.svelte';
  import { deployHelpers } from '$lib/api/queries';

  let url = $state('');
  let name = $state('');
  let authToken = $state('');
  let inboxPage = $state('Inbox');
  let showToken = $state(false);
  let verifying = $state(false);
  let verifyResult = $state<{ ok: boolean; task_count?: number; error?: string } | null>(null);
  let saving = $state(false);
  let error = $state('');

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
    error = '';
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

  async function handleFinish() {
    saving = true;
    error = '';
    try {
      if (isDesktopApp()) {
        await addSpaceDesktop(
          name.trim(),
          url.trim(),
          'Tasks',
          inboxPage.trim() || 'Inbox',
          authToken,
        );
      } else {
        await addSpace({
          name: name.trim(),
          url: url.trim(),
          inbox_page: inboxPage.trim() || 'Inbox',
          auth_token: authToken || undefined,
        });
      }
      goToStep('saving');
      await loadSpaces();
      deployHelpers().catch(() => {});
      loadInbox();
      closeOnboarding();
    } catch (e: any) {
      error = e?.error || e?.message || String(e);
      saving = false;
    }
  }

  const step = $derived(getOnboardingStep());
  const showWelcome = $derived(step === 'welcome');
  const showConnect = $derived(step === 'connect');
  const showSaving = $derived(step === 'saving');
  const canAdvanceFromConnect = $derived(!!url.trim() && !!name.trim() && verifyResult?.ok);
  const stepCount = $derived(3);
  const currentStepNum = $derived(showWelcome ? 1 : showConnect ? 2 : showSaving ? 3 : 1);
</script>

<div class="wizard-overlay" role="dialog" aria-modal="true" aria-label="Silvermind Setup">
  <div class="wizard-card">
    <div class="wizard-header">
      <div class="wizard-brand">
        <LogoSvg size="1.5rem" />
        <h1>Silvermind</h1>
      </div>
      <p class="wizard-subtitle">Task management powered by SilverBullet</p>
    </div>

    <!-- Step indicators -->
    <div class="step-indicators" role="tablist" aria-label="Setup progress">
      <span
        class="step-dot"
        class:active={showWelcome}
        aria-label="Step 1: Welcome. {showWelcome ? 'Current step.' : ''}"
      ></span>
      <span class="step-line" class:active={showConnect || showSaving}></span>
      <span
        class="step-dot"
        class:active={showConnect || showSaving}
        aria-label="Step 2: Connect space. {showConnect || showSaving ? 'Current step.' : ''}"
      ></span>
      <span class="step-line" class:active={showSaving}></span>
      <span
        class="step-dot"
        class:active={showSaving}
        aria-label="Step 3: Done. {showSaving ? 'Current step.' : ''}"
      ></span>
    </div>

    <!-- Step: Welcome -->
    {#if showWelcome}
      <div class="step-content">
        <h2 class="step-title">Welcome to Silvermind</h2>
        <p class="step-desc">
          A native task management app that connects to your SilverBullet wiki. Manage todos, track
          dependencies, set recurring tasks, and more.
        </p>
        <div class="feature-cards">
          <div class="feature-card">
            <Icon name="inbox" size="1.25rem" />
            <span>Quick capture to inbox</span>
          </div>
          <div class="feature-card">
            <Icon name="calendar" size="1.25rem" />
            <span>Today's landscape view</span>
          </div>
          <div class="feature-card">
            <LogoSvg size="1.25rem" />
            <span>Multi-space support</span>
          </div>
          <div class="feature-card">
            <Icon name="repeat" size="1.25rem" />
            <span>Recurring tasks</span>
          </div>
        </div>
        <div class="wizard-actions">
          <button class="btn btn-primary btn-full" onclick={() => goToStep('connect')}>
            Connect a Space
            <Icon name="arrow-right" size="0.875rem" />
          </button>
        </div>
      </div>

      <!-- Step: Connect Space -->
    {:else if showConnect}
      <div class="step-content">
        <h2 class="step-title">Connect Your Space</h2>
        <p class="step-desc">
          Enter your SilverBullet wiki URL. The app will verify the connection before saving.
        </p>

        <div class="form-field">
          <label for="wizard-url">Space URL</label>
          <input
            id="wizard-url"
            type="text"
            bind:value={url}
            oninput={(e: any) => updateNameFromURL(e.target.value)}
            placeholder="https://notes.example.com"
            class="field-input"
          />
        </div>

        <div class="form-field">
          <label for="wizard-name">Display Name</label>
          <input
            id="wizard-name"
            type="text"
            bind:value={name}
            placeholder="notes"
            class="field-input"
          />
        </div>

        <div class="form-field">
          <label for="wizard-inbox-page"
            >Inbox Page <span class="label-optional">optional</span></label
          >
          <input
            id="wizard-inbox-page"
            type="text"
            bind:value={inboxPage}
            placeholder="Inbox"
            class="field-input"
          />
        </div>

        <div class="form-field">
          <label for="wizard-token">Auth Token <span class="label-optional">optional</span></label>
          <div class="token-row">
            <input
              id="wizard-token"
              type={showToken ? 'text' : 'password'}
              bind:value={authToken}
              placeholder="silverbullet"
              class="field-input"
            />
            <button
              class="token-toggle"
              onclick={() => (showToken = !showToken)}
              aria-label="Toggle token visibility"
            >
              <Icon name={showToken ? 'eye-off' : 'eye'} size="0.875rem" />
            </button>
          </div>
        </div>

        {#if verifyResult}
          <div
            class="verify-result"
            class:ok={verifyResult.ok}
            class:fail={!verifyResult.ok}
            role="status"
          >
            {#if verifyResult.ok}
              <Icon name="check-circle" size="0.875rem" /> Connected — {verifyResult.task_count} task{verifyResult.task_count ===
              1
                ? ''
                : 's'} found.
            {:else}
              <Icon name="alert-circle" size="0.875rem" /> {verifyResult.error}
            {/if}
          </div>
        {/if}

        {#if error}
          <div class="wizard-error" role="alert">{error}</div>
        {/if}

        <div class="wizard-actions wizard-actions-row">
          <button
            class="btn btn-secondary"
            onclick={handleVerify}
            disabled={verifying || !url.trim()}
          >
            {verifying ? 'Verifying…' : 'Verify Connection'}
          </button>
          <button
            class="btn btn-primary"
            onclick={handleFinish}
            disabled={saving || !canAdvanceFromConnect}
          >
            {saving ? 'Saving…' : 'Save & Continue'}
          </button>
        </div>
      </div>

      <!-- Step: Saving -->
    {:else if showSaving}
      <div class="step-content saving-step">
        <div class="saving-spinner">
          <Icon name="loader" size="2rem" />
        </div>
        <h2 class="step-title">Setting things up…</h2>
        <p class="step-desc">Loading your tasks. This will just take a moment.</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .wizard-overlay {
    position: fixed;
    inset: 0;
    z-index: var(--z-modal);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.55);
    padding: var(--space-4);
    animation: fadeIn 0.2s ease;
  }
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .wizard-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    padding: 2rem 2rem 1.75rem;
    max-width: 460px;
    width: 100%;
    box-shadow: var(--shadow-xl);
    animation: slideUp 0.25s ease;
  }
  @keyframes slideUp {
    from {
      transform: translateY(12px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .wizard-header {
    text-align: center;
    margin-bottom: 1.25rem;
  }
  .wizard-brand {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    color: var(--color-accent);
  }
  .wizard-brand h1 {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    color: var(--color-text);
  }
  .wizard-subtitle {
    color: var(--color-text-tertiary);
    font-size: var(--font-size-sm);
    margin-top: 0.375rem;
  }

  .step-indicators {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0;
    margin-bottom: 1.5rem;
  }
  .step-dot {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: 2px solid var(--color-border);
    background: var(--color-bg);
    transition: all 0.25s ease;
    flex-shrink: 0;
  }
  .step-dot.active {
    border-color: var(--color-accent);
    background: var(--color-accent);
  }
  .step-line {
    display: inline-block;
    width: 40px;
    height: 2px;
    background: var(--color-border);
    transition: background 0.25s ease;
    flex-shrink: 0;
  }
  .step-line.active {
    background: var(--color-accent);
  }

  .step-content {
    animation: fadeIn 0.2s ease;
  }
  .step-title {
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }
  .step-desc {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin-bottom: 1.25rem;
  }

  .feature-cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
    margin-bottom: 1.25rem;
  }
  .feature-card {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
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
  .label-optional {
    font-weight: var(--font-weight-normal);
    color: var(--color-text-tertiary);
    font-size: var(--font-size-xs);
  }
  .field-input {
    width: 100%;
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--font-size-sm);
    transition: border-color 0.15s;
  }
  .field-input:focus {
    outline: none;
    border-color: var(--color-accent);
    box-shadow: 0 0 0 2px var(--color-accent-light);
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
    background: transparent;
    cursor: pointer;
    border: none;
  }
  .token-toggle:hover {
    color: var(--color-text-secondary);
  }

  .verify-result {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.625rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    margin-bottom: 0.75rem;
  }
  .verify-result.ok {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
  .verify-result.fail {
    background: var(--color-danger-light);
    color: var(--color-danger);
  }

  .wizard-error {
    padding: 0.5rem 0.625rem;
    background: var(--color-danger-light);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    margin-bottom: 0.75rem;
  }

  .wizard-actions {
    margin-top: 1rem;
  }
  .wizard-actions-row {
    display: flex;
    gap: 0.5rem;
  }
  .wizard-actions-row .btn {
    flex: 1;
  }
  .saving-step {
    text-align: center;
    padding: 1.5rem 0 0.5rem;
  }
  .saving-spinner {
    color: var(--color-accent);
    margin-bottom: 0.75rem;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
    text-align: center;
    border: none;
    transition:
      filter 0.15s,
      background 0.15s;
  }
  .btn:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .btn-primary {
    background: var(--color-accent);
    color: var(--color-on-accent);
    width: 100%;
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
    width: 100%;
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--color-border);
  }
  .btn-full {
    width: 100%;
  }
</style>
