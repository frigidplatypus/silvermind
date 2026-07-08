import type { Task } from './task-types';

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;
const JOURNAL_RE = /^\[\[Journal\/(\d{4}-\d{2}-\d{2})\]\]\s*(\d{2}:\d{2})?$/;

export function formatWikiLinks(text: string, spaceURL: string): string {
  return text.replace(WIKI_LINK_RE, (_, name: string) => {
    const encoded = encodeURIComponent(name);
    return `<a href="${spaceURL}/${encoded}">${name}</a>`;
  });
}

export function formatJournalLink(date: string, time?: string): string {
  const link = `[[Journal/${date}]]`;
  return time ? `${link} ${time}` : link;
}

export function parseJournalLink(value: string): { date: string; time?: string } | null {
  const m = value.match(JOURNAL_RE);
  if (!m) return null;
  return { date: m[1], time: m[2] || undefined };
}

function sortKeys(obj: Record<string, string>): [string, string][] {
  return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}

export function toMarkdown(task: Task): string {
  const displayStatus = task.status === '' ? ' ' : task.status;
  const tagStr = task.tags.length > 0 ? ' ' + task.tags.map(t => `#${t}`).join(' ') : '';
  const parts: string[] = [`- [${displayStatus}] ${task.text}${tagStr}`];

  const attrs: Record<string, string> = {};

  if (task.due) attrs['due'] = task.due.includes('"') ? task.due : `"${task.due}"`;
  if (task.deferred) attrs['deferred'] = task.deferred.includes('"') ? task.deferred : `"${task.deferred}"`;
  if (task.name) attrs['name'] = task.name;
  if (task.priority) attrs['priority'] = task.priority;
  if (task.parent) attrs['parent'] = task.parent;
  if (task.recur) attrs['recur'] = task.recur;
  if (task.alerts && task.alerts.length > 0) attrs['alerts'] = task.alerts.join(', ');
  if (task.depends_on && task.depends_on.length > 0) attrs['dependsOn'] = task.depends_on.join(', ');

  if (task.extra_attrs) {
    for (const [k, v] of Object.entries(task.extra_attrs)) {
      attrs[k] = v;
    }
  }

  for (const [key, val] of sortKeys(attrs)) {
    const qv = key === 'due' || key === 'deferred' ? val : val.includes('"') ? val : `"${val}"`;
    parts.push(`[${key}: ${qv}]`);
  }

  return parts.join(' ');
}
