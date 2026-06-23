<script lang="ts">
  import Icon from './Icon.svelte';
  import { saveQuery, testQuery, checkHelpers, deployHelpers } from '$lib/api/queries';
  import { loadQueryPages } from '$lib/stores/queries.svelte';
  import { goto } from '$lib/router';
  import { getBuilderEdit, clearBuilderEdit } from '$lib/stores/builder-edit.svelte';
  import { onMount } from 'svelte';

  let page = $state('');
  let title = $state('');
  let create = $state(true);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  let editBlockNumber = $state(0);
  let helpersMissing = $state(false);
  let deployingHelpers = $state(false);

  onMount(() => {
    const edit = getBuilderEdit();
    if (edit.page) {
      page = edit.page;
      title = edit.title;
      create = false;
      editBlockNumber = edit.blockNumber;
      if (edit.sliq) prefillFromSLIQ(edit.sliq);
      clearBuilderEdit();
    }
    checkHelpers().then(r => { helpersMissing = !r.exists; }).catch(() => {});
  });

  async function handleDeployHelpers() {
    deployingHelpers = true;
    try {
      await deployHelpers();
      helpersMissing = false;
    } catch {
      error = 'Failed to deploy helpers';
    } finally {
      deployingHelpers = false;
    }
  }

  let statusIncludes = $state<Set<string>>(new Set());
  let statusExcludes = $state<Set<string>>(new Set());
  let priority = $state('');

  function statusState(value: string): 'none' | 'include' | 'exclude' {
    if (statusIncludes.has(value)) return 'include';
    if (statusExcludes.has(value)) return 'exclude';
    return 'none';
  }

  function cycleStatus(value: string) {
    const current = statusState(value);
    const nextIncludes = new Set(statusIncludes);
    const nextExcludes = new Set(statusExcludes);
    if (current === 'none') {
      nextIncludes.add(value);
      nextExcludes.delete(value);
    } else if (current === 'include') {
      nextIncludes.delete(value);
      nextExcludes.add(value);
    } else {
      nextExcludes.delete(value);
    }
    statusIncludes = nextIncludes;
    statusExcludes = nextExcludes;
  }

  function extractQuoted(s: string, after: string): string | null {
    const idx = s.indexOf(after);
    if (idx < 0) return null;
    let rest = s.slice(idx + after.length).trimStart();
    if (rest.startsWith('"')) {
      rest = rest.slice(1);
      const end = rest.indexOf('"');
      if (end >= 0) return rest.slice(0, end);
    }
    return rest.replace(/[)"].*$/, '').trim() || null;
  }

  function prefillFromSLIQ(sliq: string) {
    const lines = sliq.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('from ') || line.startsWith('select ')) continue;

      line = line.replace(/^(where|and)\s+/, '');

      const clauses = line.split(' or ');
      for (let clause of clauses) {
        clause = clause.trim();

        if (clause === 'p.done') {
          statusIncludes = new Set([...statusIncludes, 'done']);
        } else if (clause === 'not p.done') {
          statusExcludes = new Set([...statusExcludes, 'done']);
        } else if (clause.startsWith('p.state == ')) {
          const st = extractQuoted(clause, 'p.state == ');
          if (st) statusIncludes = new Set([...statusIncludes, st]);
        } else if (clause.startsWith('p.state != ')) {
          const st = extractQuoted(clause, 'p.state != ');
          if (st) statusExcludes = new Set([...statusExcludes, st]);
        } else if (clause.startsWith('p.priority == ')) {
          const pri = extractQuoted(clause, 'p.priority == ');
          if (pri && (availablePriorities as string[]).includes(pri)) priority = pri;
        } else if (clause.startsWith('table.includes(p.tags, ')) {
          const tag = extractQuoted(clause, 'table.includes(p.tags, ');
          if (tag) includeTags = includeTags ? `${includeTags}, ${tag}` : tag;
        } else if (clause.startsWith('not table.includes(p.tags, ')) {
          const tag = extractQuoted(clause, 'not table.includes(p.tags, ');
          if (tag) excludeTags = excludeTags ? `${excludeTags}, ${tag}` : tag;
        } else if (clause.startsWith('not p.page:startsWith(')) {
          pageFilterType = 'not-starts';
          pageFilterValue = extractQuoted(clause, 'not p.page:startsWith(') ?? '';
        } else if (clause.startsWith('p.page:startsWith(')) {
          pageFilterType = 'starts';
          pageFilterValue = extractQuoted(clause, 'p.page:startsWith(') ?? '';
        } else if (clause.startsWith('p.page == ')) {
          pageFilterType = 'equals';
          pageFilterValue = extractQuoted(clause, 'p.page == ') ?? '';
        } else if (/^p\.\w+\s*==\s*"/.test(clause)) {
          const m = clause.match(/^p\.(\w+)\s*==\s*"(.*)"$/);
          if (m) extraAttrs = [...extraAttrs, { key: m[1], value: m[2] }];
        }
      }

      if (line.includes('p.due != nil') || line.includes('p.scheduled != nil')) {
        hasDateFilter = 'has';
      } else if (line.includes('p.due == nil') || line.includes('p.scheduled == nil')) {
        hasDateFilter = 'missing';
      }

      if (line.includes('p.scheduled')) dateField = 'scheduled';

      if (!activePresetLabel) {
        if ((line.includes('"@today"') || line.includes('today()')) && line.includes('==')) {
          activePresetLabel = 'Today';
        } else if ((line.includes('"@tomorrow"') || line.includes('tomorrow()')) && line.includes('==')) {
          activePresetLabel = 'Tomorrow';
        } else if ((line.includes('"@today"') || line.includes('today()')) && line.includes('<')) {
          activePresetLabel = 'Overdue';
        } else if (line.includes('"@week_start"') || line.includes('weekStart()')) {
          activePresetLabel = 'This week';
        } else if (line.includes('"@+7"') || line.includes('addDays(7)')) {
          activePresetLabel = 'Next week';
        } else if (line.includes('"@month_start"') || line.includes('monthStart()')) {
          activePresetLabel = 'This month';
        }
      }

      if (!activePresetLabel) {
        const prefix = line.includes('p.scheduled') ? 'p.scheduled' : 'p.due';
        if (line.includes(`${prefix} > "`)) rangeStart = extractQuoted(line, `${prefix} > `) ?? '';
        if (line.includes(`${prefix} < "`)) rangeEnd = extractQuoted(line, `${prefix} < `) ?? '';
      }

      if (line.startsWith('order by ')) {
        const rest = line.slice('order by '.length).trim();
        const parts = rest.split(/\s+/);
        const field = parts[0].replace(/^p\./, '').replace(',', '').trim();
        if ((sortOptions as {value:string}[]).some(o => o.value === field)) {
          sortBy = field;
          sortOrder = parts[1] === 'desc' ? 'desc' : 'asc';
        }
      }

      if (line.startsWith('limit ')) {
        const n = parseInt(line.slice('limit '.length));
        if (!isNaN(n) && n > 0) limit = n;
      }
    }
  }

  let pageFilterType = $state<'equals' | 'starts' | 'not-starts'>('equals');
  let pageFilterValue = $state('');
  let dateField = $state<'due' | 'scheduled'>('due');
  let dateMode = $state<'relative' | 'calendar'>('relative');
  let rangeStart = $state('');
  let rangeEnd = $state('');
  let hasDateFilter = $state<'none' | 'has' | 'missing'>('none');
  const datePresets: { label: string; sliq: string }[] = [
    { label: 'Today',      sliq: `p.${dateField} == today()` },
    { label: 'Tomorrow',   sliq: `p.${dateField} == tomorrow()` },
    { label: 'Overdue',    sliq: `p.${dateField} < today()` },
    { label: 'This week',  sliq: `p.${dateField} >= weekStart() and p.${dateField} <= weekEnd()` },
    { label: 'Next week',  sliq: `p.${dateField} >= addDays(7) and p.${dateField} <= addDays(13)` },
    { label: 'This month', sliq: `p.${dateField} >= monthStart() and p.${dateField} <= monthEnd()` },
  ];
  let activePresetLabel = $state<string | null>(null);

  function presetSLIQ(): string {
    if (!activePresetLabel) return '';
    const p = datePresets.find(x => x.label === activePresetLabel);
    return p ? p.sliq : '';
  }

  function applyPreset(label: string) {
    activePresetLabel = label;
    rangeStart = '';
    rangeEnd = '';
    hasDateFilter = 'none';
  }

  function clearPreset() {
    activePresetLabel = null;
  }
  let includeTags = $state('');
  let excludeTags = $state('');
  let extraAttrs = $state<{ key: string; value: string }[]>([]);
  let sortBy = $state('');
  let sortOrder = $state<'asc' | 'desc'>('asc');
  let limit = $state(100);

  let testing = $state(false);
  let testResult = $state<{ count: number; preview: string[] } | null>(null);

  const availableStatuses = [
    { value: 'done', label: 'Done' },
    { value: 'waiting', label: 'Waiting' },
    { value: 'maybe', label: 'Maybe' },
    { value: 'someday', label: 'Someday' },
  ];
  const availablePriorities = ['high', 'medium', 'low'];
  const sortOptions = [
    { value: '', label: 'Default' },
    { value: 'priority', label: 'Priority' },
    { value: 'due', label: 'Due date' },
    { value: 'scheduled', label: 'Scheduled date' },
    { value: 'page', label: 'Page' },
  ];

  function addExtraAttr() {
    extraAttrs = [...extraAttrs, { key: '', value: '' }];
  }

  function removeExtraAttr(index: number) {
    extraAttrs = extraAttrs.filter((_, i) => i !== index);
  }

   function buildSLIQ(): string {
    const lines: string[] = ['from p = index.objects("task")'];

    const statusClauses: string[] = [];
    for (const s of statusIncludes) {
      if (s === 'done') statusClauses.push('p.done');
      else statusClauses.push(`p.state == "${s}"`);
    }
    for (const s of statusExcludes) {
      if (s === 'done') statusClauses.push('not p.done');
      else statusClauses.push(`p.state != "${s}"`);
    }
    if (statusClauses.length > 0) {
      const joined = statusClauses.join(' or ');
      const prefix = lines.length <= 1 ? 'where' : 'and';
      lines.push(`${prefix} ${joined}`);
    }

    if (priority) {
      const prefix = lines.length <= 1 ? 'where' : 'and';
      lines.push(`${prefix} p.priority == "${priority}"`);
    }

    if (pageFilterValue) {
      const prefix = lines.length <= 1 ? 'where' : 'and';
      if (pageFilterType === 'equals') {
        lines.push(`${prefix} p.page == "${pageFilterValue}"`);
      } else if (pageFilterType === 'starts') {
        lines.push(`${prefix} p.page:startsWith("${pageFilterValue}")`);
      } else if (pageFilterType === 'not-starts') {
        lines.push(`${prefix} not p.page:startsWith("${pageFilterValue}")`);
      }
    }

    if (activePresetLabel) {
      const sliq = presetSLIQ();
      if (sliq) {
        const clauses = sliq.split(' and ');
        for (const clause of clauses) {
          const prefix = lines.length <= 1 ? 'where' : 'and';
          lines.push(`${prefix} ${clause}`);
        }
      }
    } else {
      if (hasDateFilter === 'has') {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} p.${dateField} != nil`);
      } else if (hasDateFilter === 'missing') {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} p.${dateField} == nil`);
      }

      if (rangeStart) {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} p.${dateField} > "${rangeStart}"`);
      }
      if (rangeEnd) {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} p.${dateField} < "${rangeEnd}"`);
      }
    }

    if (includeTags) {
      const tagList = includeTags.split(',').map(t => t.trim()).filter(Boolean);
      for (const tag of tagList) {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} table.includes(p.tags, "${tag}")`);
      }
    }

    if (excludeTags) {
      const tagList = excludeTags.split(',').map(t => t.trim()).filter(Boolean);
      for (const tag of tagList) {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} not table.includes(p.tags, "${tag}")`);
      }
    }

    for (const attr of extraAttrs) {
      if (attr.key && attr.value) {
        const prefix = lines.length <= 1 ? 'where' : 'and';
        lines.push(`${prefix} p.${attr.key} == "${attr.value}"`);
      }
    }

    if (sortBy) {
      lines.push(`order by p.${sortBy}${sortOrder === 'desc' ? ' desc' : ''}`);
    }

    if (limit && limit !== 100) {
      lines.push(`limit ${limit}`);
    }

    lines.push('select templates.taskItem(p)');

    return lines.join('\n');
  }

  let sliqPreview = $derived(buildSLIQ());
  let hasFilters = $derived(sliqPreview.trim().length > 0);

  async function handleTest() {
    if (!hasFilters) { error = 'At least one filter is required'; return; }
    testing = true;
    error = null;
    testResult = null;
    try {
      const result = await testQuery(sliqPreview);
      testResult = {
        count: result.tasks.length,
        preview: result.tasks.slice(0, 5).map(t => t.text),
      };
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to test query';
    } finally {
      testing = false;
    }
  }

  async function handleSave() {
    if (!page.trim()) { error = 'Page name is required'; return; }
    if (!title.trim()) { error = 'Query title is required'; return; }
    if (!hasFilters) { error = 'At least one filter is required'; return; }

    saving = true;
    error = null;
    success = null;

    try {
      await saveQuery({
        page: page.trim(),
        title: title.trim(),
        sliq: sliqPreview,
        create,
        ...(editBlockNumber > 0 ? { block_number: editBlockNumber } : {}),
      });
      success = `Saved to "${page.trim()}" as "${title.trim()}"`;
      await loadQueryPages();
      setTimeout(() => goto(`/queries:${page.trim()}`), 1000);
    } catch (e) {
      error = e instanceof Error ? e.message : 'Failed to save query';
    } finally {
      saving = false;
    }
  }

  function handleClear() {
    page = '';
    title = '';
    create = true;
    statusIncludes = new Set();
    statusExcludes = new Set();
    priority = '';
    pageFilterType = 'equals';
    pageFilterValue = '';
    dateField = 'due';
    rangeStart = '';
    rangeEnd = '';
    hasDateFilter = 'none';
    activePresetLabel = null;
    includeTags = '';
    excludeTags = '';
    extraAttrs = [];
    sortBy = '';
    sortOrder = 'asc';
    limit = 100;
    error = null;
    success = null;
    testResult = null;
  }
</script>

<div class="query-builder">
  <h2 class="builder-title">New Query</h2>

  {#if success}
    <div class="success-banner" role="status">{success}</div>
  {/if}
  {#if error}
    <div class="error-banner" role="alert">{error}</div>
  {/if}
  {#if helpersMissing}
    <div class="helpers-banner" role="alert">
      <span>Date helpers not installed. Queries using date presets won&rsquo;t render in SilverBullet.</span>
      <button class="btn btn-secondary" onclick={handleDeployHelpers} disabled={deployingHelpers}>
        {deployingHelpers ? 'Deploying…' : 'Deploy'}
      </button>
    </div>
  {/if}

  <div class="form-section">
    <label class="field-label">
      <span>Save to page</span>
      <input type="text" bind:value={page} placeholder="e.g. queries/my-filters" class="field-input" />
      <span class="field-hint">The sbtask page to store this query on</span>
    </label>
    <label class="field-label">
      <span>Query title</span>
      <input type="text" bind:value={title} placeholder="e.g. High Priority Tasks" class="field-input" />
      <span class="field-hint">Displayed as the heading in the sidebar</span>
    </label>
  </div>

  <div class="form-section">
    <h3 class="section-title">Filters</h3>

    <fieldset class="filter-group">
      <legend class="filter-label">Status</legend>
      <div class="checkbox-group">
        {#each availableStatuses as s}
          <button
            class="status-{statusState(s.value)}"
            onclick={() => cycleStatus(s.value)}
            aria-pressed={statusState(s.value) !== 'none'}
          >
            {#if statusState(s.value) === 'include'}
              <Icon name="check" size="0.75rem" />
            {:else if statusState(s.value) === 'exclude'}
              <Icon name="x" size="0.75rem" />
            {:else}
              <span class="status-circle"></span>
            {/if}
            <span>{s.label}</span>
          </button>
        {/each}
      </div>
      <p class="field-hint">Click to cycle: include → exclude → none</p>
    </fieldset>

    <div class="filter-group">
      <span class="filter-label">Priority</span>
      <select bind:value={priority} class="field-input">
        <option value="">Any priority</option>
        {#each availablePriorities as p}
          <option value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
        {/each}
      </select>
    </div>

    <div class="filter-group">
      <span class="filter-label">Page filter</span>
      <div class="filter-row">
        <select bind:value={pageFilterType} class="field-input filter-type">
          <option value="equals">equals</option>
          <option value="starts">starts with</option>
          <option value="not-starts">not starts with</option>
        </select>
        <input type="text" bind:value={pageFilterValue} placeholder="page name" class="field-input" />
      </div>
    </div>

    <div class="filter-group">
      <div class="filter-label-row">
        <span class="filter-label">Date filter</span>
        <div class="date-field-toggle">
          <button class="toggle-btn" class:active={dateField === 'due'} onclick={() => (dateField = 'due')}>Due</button>
          <button class="toggle-btn" class:active={dateField === 'scheduled'} onclick={() => (dateField = 'scheduled')}>Scheduled</button>
        </div>
      </div>
      <div class="date-mode-toggle">
        <button class="toggle-btn" class:active={dateMode === 'relative'} onclick={() => (dateMode = 'relative')}>Relative</button>
        <button class="toggle-btn" class:active={dateMode === 'calendar'} onclick={() => (dateMode = 'calendar')}>Calendar</button>
      </div>
      {#if dateMode === 'relative'}
        <div class="preset-group">
          {#each datePresets as p}
            <button class="toggle-btn" class:active={activePresetLabel === p.label} onclick={() => applyPreset(p.label)}>{p.label}</button>
          {/each}
          {#if activePresetLabel}
            <button class="toggle-btn" onclick={clearPreset}>Clear</button>
          {/if}
        </div>
      {:else}
        <div class="filter-row" style="margin-top: 0.5rem">
          <input type="date" bind:value={rangeStart} class="field-input" />
          <span class="range-sep">to</span>
          <input type="date" bind:value={rangeEnd} class="field-input" />
        </div>
        <div class="checkbox-group" style="margin-top: 0.5rem">
          <label class="checkbox-item">
            <input type="radio" name="date-exists" value="none" bind:group={hasDateFilter} />
            <span>Any</span>
          </label>
          <label class="checkbox-item">
            <input type="radio" name="date-exists" value="has" bind:group={hasDateFilter} />
            <span>Has date</span>
          </label>
          <label class="checkbox-item">
            <input type="radio" name="date-exists" value="missing" bind:group={hasDateFilter} />
            <span>No date</span>
          </label>
        </div>
      {/if}
    </div>

    <div class="filter-group">
      <span class="filter-label">Include tags</span>
      <input type="text" bind:value={includeTags} placeholder="comma separated, e.g. work, urgent" class="field-input" />
    </div>

    <div class="filter-group">
      <span class="filter-label">Exclude tags</span>
      <input type="text" bind:value={excludeTags} placeholder="comma separated, e.g. archive, done" class="field-input" />
    </div>

    <div class="filter-group">
      <div class="filter-label-row">
        <span class="filter-label">Custom attributes</span>
        <button class="add-btn" onclick={addExtraAttr} aria-label="Add attribute"><Icon name="plus" size="0.875rem" /></button>
      </div>
      {#each extraAttrs as attr, i}
        <div class="extra-row">
          <input type="text" bind:value={attr.key} placeholder="key" class="field-input extra-key" />
          <input type="text" bind:value={attr.value} placeholder="value" class="field-input" />
          <button class="remove-btn" onclick={() => removeExtraAttr(i)} aria-label="Remove attribute"><Icon name="x" size="0.875rem" /></button>
        </div>
      {/each}
    </div>
  </div>

  <div class="form-section">
    <h3 class="section-title">Options</h3>
    <div class="options-row">
      <label class="field-label">
        <span>Sort by</span>
        <select bind:value={sortBy} class="field-input">
          {#each sortOptions as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </label>
      <label class="field-label">
        <span>Order</span>
        <select bind:value={sortOrder} class="field-input">
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </label>
      <label class="field-label">
        <span>Limit</span>
        <input type="number" bind:value={limit} min="1" max="1000" class="field-input" />
      </label>
    </div>
  </div>

  <div class="form-section">
    <div class="preview-header">
      <h3 class="section-title">SLIQ Preview</h3>
      <button class="btn btn-secondary btn-test" onclick={handleTest} disabled={testing || !hasFilters}>
        {testing ? 'Testing…' : 'Test'}
      </button>
    </div>
    <pre class="sliq-preview">{sliqPreview || '(no filters selected)'}</pre>
    {#if testResult}
      <div class="test-result" role="status">
        <span class="test-count">{testResult.count} task{testResult.count === 1 ? '' : 's'} found</span>
        {#if testResult.preview.length > 0}
          <ul class="test-preview">
            {#each testResult.preview as t}
              <li>{t}</li>
            {/each}
            {#if testResult.count > 5}
              <li class="test-more">…and {testResult.count - 5} more</li>
            {/if}
          </ul>
        {/if}
      </div>
    {/if}
  </div>

  <div class="form-section">
    <label class="checkbox-item">
      <input type="checkbox" bind:checked={create} />
      <span>Create as new page</span>
    </label>
    <p class="field-hint">Checked: creates a new page with this query. Unchecked: appends to an existing page.</p>
  </div>

  <div class="button-row">
    <button class="btn btn-primary" onclick={handleSave} disabled={saving || !hasFilters}>
      {saving ? 'Saving…' : 'Save Query'}
    </button>
    <button class="btn btn-secondary" onclick={handleClear}>Clear</button>
  </div>
</div>

<style>
  .query-builder {
    padding: 1.5rem;
    max-width: 640px;
    margin: 0 auto;
  }
  .builder-title {
    font-size: var(--font-size-xl);
    font-weight: var(--font-weight-bold);
    margin-bottom: var(--space-4);
    color: var(--color-text);
  }
  .form-section {
    margin-bottom: 1.25rem;
  }
  .section-title {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-tertiary);
    margin-bottom: var(--space-3);
  }
  .field-label {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text);
    margin-bottom: var(--space-3);
  }
  .field-hint {
    font-size: var(--font-size-xs);
    color: var(--color-text-tertiary);
    margin-top: 0.125rem;
  }
  .field-input {
    padding: 0.5rem 0.625rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    font-size: var(--font-size-sm);
    width: 100%;
  }
  .filter-group {
    margin-bottom: var(--space-4);
    border: none;
    padding: 0;
    min-width: 0;
  }
  .filter-label {
    display: block;
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: var(--color-text-secondary);
    margin-bottom: 0.375rem;
  }
  .filter-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.375rem;
  }
  .checkbox-group {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }
  .checkbox-item {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    cursor: pointer;
  }
  .checkbox-item input[type="checkbox"]:checked + span,
  .checkbox-item input[type="radio"]:checked + span {
    color: var(--color-accent);
    font-weight: var(--font-weight-semibold);
  }
  .status-none, .status-include, .status-exclude {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: var(--radius-full);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s, color 0.15s;
  }
  .status-none .status-circle {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    border: 1.5px solid var(--color-border);
    flex-shrink: 0;
  }
  .status-include {
    color: var(--color-accent);
    border-color: var(--color-accent);
    background: var(--color-accent-light);
    font-weight: var(--font-weight-semibold);
  }
  .status-exclude {
    color: var(--color-danger);
    border-color: var(--color-danger);
    background: var(--color-danger-light);
    font-weight: var(--font-weight-semibold);
  }
  .filter-row {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  .filter-type {
    width: auto;
    flex-shrink: 0;
  }
  .range-sep {
    font-size: var(--font-size-sm);
    color: var(--color-text-tertiary);
  }
  .date-field-toggle {
    display: flex;
    gap: 0.125rem;
  }
  .preset-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
  .toggle-btn {
    padding: 0.125rem 0.625rem;
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    color: var(--color-text-secondary);
  }
  .toggle-btn.active {
    background: var(--color-accent);
    color: var(--color-on-accent);
    font-weight: var(--font-weight-semibold);
  }
  .options-row {
    display: flex;
    gap: var(--space-3);
  }
  .options-row .field-label {
    flex: 1;
    margin-bottom: 0;
  }
  .extra-row {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.375rem;
  }
  .extra-key {
    width: 120px;
    flex-shrink: 0;
  }
  .add-btn, .remove-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.25rem;
    border-radius: var(--radius-sm);
    color: var(--color-text-tertiary);
  }
  .add-btn:hover, .remove-btn:hover {
    color: var(--color-accent);
  }
  .preview-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-3);
  }
  .preview-header .section-title {
    margin-bottom: 0;
  }
  .btn-test {
    padding: 0.25rem 0.75rem;
    font-size: var(--font-size-xs);
  }
  .sliq-preview {
    background: var(--color-bg-secondary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    padding: var(--space-3);
    font-family: var(--font-family-mono);
    font-size: var(--font-size-sm);
    color: var(--color-text);
    white-space: pre-wrap;
    min-height: 3rem;
  }
  .test-result {
    margin-top: var(--space-3);
    padding: var(--space-3);
    background: var(--color-accent-light);
    border-radius: var(--radius-md);
  }
  .test-count {
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    color: var(--color-accent);
  }
  .test-preview {
    margin-top: var(--space-2);
    padding-left: var(--space-4);
    font-size: var(--font-size-sm);
    color: var(--color-text-secondary);
  }
  .test-preview li {
    margin-top: 0.25rem;
  }
  .test-more {
    color: var(--color-text-tertiary);
    font-style: italic;
  }
  .button-row {
    display: flex;
    gap: var(--space-3);
    margin-top: 1.5rem;
  }
  .btn {
    padding: 0.5rem 1.25rem;
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-semibold);
    cursor: pointer;
  }
  .btn-primary {
    background: var(--color-accent);
    color: var(--color-on-accent);
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-secondary {
    background: var(--color-bg-tertiary);
    color: var(--color-text-secondary);
  }
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .btn-secondary:hover:not(:disabled) {
    background: var(--color-border);
  }
  .btn-primary:hover:not(:disabled) {
    filter: brightness(1.1);
  }
  .success-banner {
    padding: 0.625rem 0.75rem;
    background: var(--color-accent-light);
    color: var(--color-accent);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--space-4);
  }
  .error-banner {
    padding: 0.625rem 0.75rem;
    background: var(--color-danger-light);
    color: var(--color-danger);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--space-4);
  }
  .helpers-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    padding: 0.625rem 0.75rem;
    background: var(--color-accent-light);
    color: var(--color-accent);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    margin-bottom: var(--space-4);
  }
</style>