<script lang="ts">
  let {
    items,
    placeholder = 'Search…',
    onselect,
    id = '',
    allowFreeText = false,
    freeTextLabel = 'Create: {query}',
    value = '',
  }: {
    items: string[];
    placeholder?: string;
    onselect?: (item: string) => void;
    id?: string;
    allowFreeText?: boolean;
    freeTextLabel?: string;
    value?: string;
  } = $props();

  let query = $state(value);
  let focused = $state(false);
  let selectedIndex = $state(0);

  // Sync query with value prop
  $effect(() => {
    if (value !== query) {
      query = value;
    }
  });

  const filtered = $derived(
    query.trim()
      ? items.filter((i) => i.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
      : [],
  );

  function handleSelect(item: string) {
    onselect?.(item);
    query = '';
    selectedIndex = 0;
    focused = false;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) {
        handleSelect(filtered[selectedIndex]);
      } else if (allowFreeText && query.trim()) {
        onselect?.(query.trim());
        query = '';
        selectedIndex = 0;
        focused = false;
      }
    } else if (e.key === 'Escape') {
      focused = false;
    }
  }

  const hasExactMatch = $derived(filtered.some((f) => f.toLowerCase() === query.toLowerCase()));
  const showCreate = $derived(allowFreeText && query.trim() && !hasExactMatch);
</script>

<div class="autocomplete">
  <input
    {id}
    type="text"
    class="ac-input"
    bind:value={query}
    {placeholder}
    onfocus={() => ((focused = true), (selectedIndex = 0))}
    onblur={() => setTimeout(() => (focused = false), 150)}
    onkeydown={handleKeydown}
    autocomplete="off"
    role="combobox"
    aria-expanded={Boolean(focused && (filtered.length > 0 || showCreate))}
    aria-controls={id ? `${id}-listbox` : null}
    aria-activedescendant={focused && filtered[selectedIndex] && id
      ? `${id}-opt-${selectedIndex}`
      : null}
    aria-autocomplete="list"
  />
  {#if focused && (filtered.length > 0 || showCreate)}
    <ul class="ac-dropdown" role="listbox" id={id ? `${id}-listbox` : undefined}>
      {#each filtered as item, i}
        <li
          class="ac-item"
          class:selected={i === selectedIndex}
          role="option"
          id={id ? `${id}-opt-${i}` : undefined}
          aria-selected={i === selectedIndex}
          onpointerdown={(e) => {
            e.preventDefault();
            handleSelect(item);
          }}
        >
          {item}
        </li>
      {/each}
      {#if showCreate}
        <li
          class="ac-item ac-create"
          role="option"
          onpointerdown={(e) => {
            e.preventDefault();
            onselect?.(query.trim());
            query = '';
            focused = false;
          }}
        >
          <span class="ac-create-icon">+</span>
          {freeTextLabel.replace('{query}', query)}
        </li>
      {/if}
    </ul>
  {/if}
</div>

<style>
  .autocomplete {
    position: relative;
  }
  .ac-input {
    width: 100%;
    padding: 0.625rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-surface);
    font-size: var(--font-size-base);
    color: var(--color-text);
    outline: none;
  }
  .ac-input:focus {
    border-color: var(--color-accent);
  }
  .ac-dropdown {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    z-index: 350;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: 0 4px 12px var(--color-shadow);
    max-height: 14rem;
    overflow-y: auto;
    margin-top: 0.25rem;
    list-style: none;
    padding: 0.25rem;
  }
  .ac-item {
    padding: 0.5rem 0.75rem;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .ac-item.selected,
  .ac-item:hover {
    background: var(--color-accent-light);
    color: var(--color-accent);
  }
  .ac-create {
    background: var(--color-accent-light);
    color: var(--color-accent);
    font-weight: var(--font-weight-medium);
  }
  .ac-create-icon {
    display: inline-block;
    width: 1rem;
    text-align: center;
    margin-right: 0.25rem;
  }
</style>
