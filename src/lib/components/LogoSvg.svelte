<script lang="ts">
  import logoSvg from '../assets/silvermind-logo.svg?raw';

  let { size = '1.5rem' }: { size?: string } = $props();
</script>

<span class="logo-svg" style="display:inline-flex;width:{size};height:{size};color:inherit">{@html logoSvg}</span>

<style>
  .logo-svg :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
