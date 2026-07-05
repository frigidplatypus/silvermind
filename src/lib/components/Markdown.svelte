<script lang="ts">
  import { marked, Renderer } from 'marked';
  import DOMPurify from 'dompurify';

  let {
    text,
    inline = false,
    spaceURL = '',
  }: { text: string; inline?: boolean; spaceURL?: string } = $props();

  const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

  function preprocessWikiLinks(t: string): string {
    if (!spaceURL) return t;
    return t.replace(WIKI_LINK_RE, (_, name: string) => {
      const encoded = encodeURIComponent(name);
      return `<a href="${spaceURL}/${encoded}">${name}</a>`;
    });
  }

  const renderer = new Renderer();
  renderer.link = ({ href, title, text: linkText }) => {
    const scheme = href?.toLowerCase().split(':')[0] ?? '';
    if (scheme === 'javascript' || scheme === 'data' || scheme === 'vbscript') {
      href = '#';
    }
    const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
    return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${linkText}</a>`;
  };

  const processed = $derived(preprocessWikiLinks(text));

  const html = $derived(
    DOMPurify.sanitize(
      (inline
        ? marked.parseInline(processed, { renderer })
        : marked.parse(processed, { renderer })) as string,
    ),
  );
</script>

{#if inline}
  {@html html}
{:else}
  <div class="markdown-body">{@html html}</div>
{/if}

<style>
  .markdown-body {
    word-break: break-word;
    line-height: 1.5;
  }
  :global(.markdown-body p) {
    margin: 0 0 0.5rem;
  }
  :global(.markdown-body p:last-child) {
    margin-bottom: 0;
  }
  :global(.markdown-body strong) {
    font-weight: 600;
  }
  :global(.markdown-body em) {
    font-style: italic;
  }
  :global(.markdown-body code) {
    font-size: 0.875em;
    background: var(--color-bg-tertiary);
    padding: 0.125rem 0.375rem;
    border-radius: var(--radius-sm);
  }
</style>
