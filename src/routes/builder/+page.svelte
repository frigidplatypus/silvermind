<script lang="ts">
  import QueryBuilder from '$lib/components/QueryBuilder.svelte';
  let { onNavigate }: { onNavigate?: (view: string) => void } = $props();
</script>

<QueryBuilder {onNavigate} />
