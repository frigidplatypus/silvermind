<script lang="ts">
  import feather from 'feather-icons';

  let { name, size = '1.25rem' }: { name: string; size?: string } = $props();

  const svg = $derived(feather.icons[name]?.toSvg({ width: size, height: size }) ?? '');
</script>

{#if svg}
  <span class="feather-icon" style="display:inline-flex;width:{size};height:{size}">{@html svg}</span>
{/if}
