<script lang="ts">
  import { getSplitRatio, setSplitRatio } from '$lib/stores/desktop.svelte';

  let {
    left,
    right,
    showRight = false,
  }: {
    left: import('svelte').Snippet;
    right?: import('svelte').Snippet;
    showRight?: boolean;
  } = $props();

  let dragging = $state(false);
  let startX = $state(0);
  let startRatio = $state(0);

  const ratio = $derived(getSplitRatio());

  function onPointerDown(e: PointerEvent) {
    dragging = true;
    startX = e.clientX;
    startRatio = ratio;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const container = (e.target as HTMLElement).closest('.split-pane') as HTMLElement;
    if (!container) return;
    const dx = e.clientX - startX;
    const newRatio = startRatio + dx / container.offsetWidth;
    setSplitRatio(newRatio);
  }

  function onPointerUp() {
    dragging = false;
  }

  function onKeydown(e: KeyboardEvent) {
    const step = 0.02;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setSplitRatio(ratio - step);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setSplitRatio(ratio + step);
    }
  }
</script>

<div class="split-pane" class:dragging class:has-right={showRight}>
  <div class="split-left" style="width: {showRight ? ratio * 100 : 100}%">
    {@render left()}
  </div>
  {#if showRight}
    <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
    <div
      class="split-divider"
      role="separator"
      aria-label="Resize panels"
      tabindex="0"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onkeydown={onKeydown}
    ></div>
    <div class="split-right" style="width: {(1 - ratio) * 100}%">
      {#if right}{@render right()}{/if}
    </div>
  {/if}
</div>

<style>
  .split-pane {
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .split-left, .split-right {
    overflow-y: auto;
    overflow-x: hidden;
  }
  .split-left { border-right: 1px solid var(--color-separator); }
  .has-right .split-left { border-right: none; }
  .split-divider {
    width: 4px;
    background: var(--color-separator);
    cursor: col-resize;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .split-divider:hover, .dragging .split-divider {
    background: var(--color-accent);
  }
  .dragging { user-select: none; }
</style>
