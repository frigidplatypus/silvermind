import { markTaskDone, undoTask } from '$lib/api/tasks';
import { showUndo, showError } from '$lib/stores/toast.svelte';
import type { Task } from '$lib/types/task';

export async function toggleTaskDone(task: Task, onRefresh: () => void): Promise<void> {
  try {
    await markTaskDone(task.page, task.position);
    showUndo(`${task.text.slice(0, 30)} marked done`, async () => {
      try { await undoTask(task.page, task.position); } catch {}
      onRefresh();
    });
    onRefresh();
  } catch (e: any) {
    showError(`Failed: ${e.message}`);
  }
}
