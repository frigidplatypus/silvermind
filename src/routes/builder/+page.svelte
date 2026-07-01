<script lang="ts">
  import QueryBuilder from '$lib/components/QueryBuilder.svelte';
  import { devLog } from '$lib/helpers/dev-log';

  let { onNavigate }: { onNavigate?: (view: string) => void } = $props();

  devLog('[builder-page] rendering, onNavigate=', typeof onNavigate, onNavigate ? 'defined' : 'undefined');
</script>

<QueryBuilder {onNavigate} />