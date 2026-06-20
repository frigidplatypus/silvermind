<script lang="ts">
  import { marked, Renderer } from 'marked';

  let { text, inline = false }: { text: string; inline?: boolean } = $props();

  const renderer = new Renderer();
  renderer.link = ({ href, title, text: linkText }) => {
    const titleAttr = title ? ` title="${title.replace(/"/g, '&quot;')}"` : '';
    return `<a href="${href}" target="_blank" rel="noopener noreferrer"${titleAttr}>${linkText}</a>`;
  };

  // Strip inline scripts, event handlers, and iframes for safety
  function sanitize(html: string): string {
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s+on\w+="[^"]*"/g, '')
      .replace(/\s+on\w+='[^']*'/g, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  }

  const html = $derived(sanitize(
    (inline ? marked.parseInline(text, { renderer }) : marked.parse(text, { renderer })) as string
  ));
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
