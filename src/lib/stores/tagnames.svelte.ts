import { getTasks } from '$lib/api/tasks';

let tagNames = $state<string[]>([]);
let loaded = $state(false);

export function getTagNames(): string[] { return tagNames; }
export function isLoaded(): boolean { return loaded; }

export async function loadTagNames(): Promise<void> {
  try {
    const tasks = await getTasks({ limit: '500' });
    const tags = new Set<string>();
    for (const t of tasks) {
      for (const tag of t.tags) {
        tags.add(tag);
      }
    }
    tagNames = Array.from(tags).sort();
  } catch { /* silent */ }
  loaded = true;
}
