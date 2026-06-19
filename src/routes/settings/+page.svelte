<script lang="ts">
  import { getTheme, setTheme } from '$lib/stores/theme.svelte';
  import { getSpacesList, loadSpaces } from '$lib/stores/space.svelte';
  import type { Theme } from '$lib/stores/theme.svelte';
  import Icon from '$lib/components/Icon.svelte';

  let currentTheme = $state<Theme>(getTheme());

  function onThemeChange(t: Theme) { currentTheme = t; setTheme(t); }
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
    <p class="section-desc">Spaces are configured in your sbtask config file (~/.config/sbtask/config.yaml). Changes there will appear here after a restart.</p>
    <div class="space-list">
      {#each getSpacesList() as space}
        <div class="space-item">
          <div class="space-info">
            <span class="space-name">{space.name}</span>
            <span class="space-url">{space.url}</span>
          </div>
          {#if space.active}
            <span class="active-badge">Active</span>
          {/if}
        </div>
      {/each}
    </div>
  </section>

  <section class="section">
    <h3 class="section-title">About</h3>
    <p class="about-text">Prowl — task management powered by sbtask.</p>
  </section>
</div>

<style>
  .settings-page { padding: 1rem; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .page-title { font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: 1.5rem; }
  .section { margin-bottom: 2rem; }
  .section-title { font-size: var(--font-size-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--color-text-secondary); margin-bottom: 0.75rem; }
  .section-desc { font-size: var(--font-size-sm); color: var(--color-text-tertiary); margin-bottom: 0.75rem; }
  .theme-picker { display: flex; gap: 0.5rem; }
  .theme-btn { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; flex: 1; padding: 0.75rem 0.25rem; border-radius: var(--radius-lg); background: var(--color-bg-secondary); font-size: var(--font-size-sm); color: var(--color-text-secondary); border: 2px solid transparent; }
  .theme-btn i { font-size: 1.5rem; }
  .theme-btn.active { border-color: var(--color-accent); background: var(--color-accent-light); color: var(--color-accent); }
  .theme-label { font-weight: 500; }
  .space-list { display: flex; flex-direction: column; gap: 0.5rem; }
  .space-item { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem; border-radius: var(--radius-md); background: var(--color-bg-secondary); }
  .space-info { display: flex; flex-direction: column; gap: 0.125rem; }
  .space-name { font-size: var(--font-size-base); font-weight: 500; }
  .space-url { font-size: var(--font-size-xs); color: var(--color-text-tertiary); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .active-badge { font-size: var(--font-size-xs); padding: 0.125rem 0.5rem; border-radius: var(--radius-sm); background: var(--color-success-light); color: var(--color-success); font-weight: 600; }
  .about-text { font-size: var(--font-size-sm); color: var(--color-text-tertiary); }
</style>
