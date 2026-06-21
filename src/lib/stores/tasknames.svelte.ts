import { getTasks } from '$lib/api/tasks';

let taskNames = $state<string[]>([]);
let loaded = $state(false);

export function getTaskNames(): string[] { return taskNames; }
export function isLoaded(): boolean { return loaded; }

export async function loadTaskNames(): Promise<void> {
  if (loaded) return;
  try {
    const tasks = await getTasks({ limit: '500' });
    const names = new Set<string>();
    for (const t of tasks) {
      if (t.name) names.add(t.name);
      const textName = t.text.replace(/\*\*/g, '').trim().slice(0, 60);
      if (textName) names.add(textName);
    }
    taskNames = Array.from(names).sort();
  } catch { /* silent */ }
  loaded = true;
}
