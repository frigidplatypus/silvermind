<script lang="ts">
  import { getSplitRatio, setSplitRatio } from '$lib/stores/desktop.svelte';

  let {
    children,
  }: {
    children: import('svelte').Snippet;
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
</script>

<div class="split-pane" class:dragging>
  <div class="split-left" style="width: {ratio * 100}%">
    {@render children?.left()}
  </div>
  <div
    class="split-divider"
    role="separator"
    aria-label="Resize panels"
    tabindex="0"
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
  ></div>
  <div class="split-right" style="width: {(1 - ratio) * 100}%">
    {@render children?.right()}
  </div>
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
  .dragging {
    user-select: none;
  }
</style>
