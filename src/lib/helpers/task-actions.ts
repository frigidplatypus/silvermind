import { markTaskDone, undoTask } from '$lib/api/tasks';
import { showUndo, showError } from '$lib/stores/toast.svelte';
import type { Task } from '$lib/types/task';
import { logError, logInfo } from '$lib/helpers/logger';

export async function toggleTaskDone(task: Task, onRefresh: () => void): Promise<boolean> {
  logInfo(
    `[task-action] toggle requested — action=${task.done ? 'undo' : 'done'} space="${task._spaceName ?? ''}" url="${task._spaceUrl ?? ''}" page="${task.page}" pos=${task.position} status="${task.status}" text="${(task.text || '').slice(0, 120)}"`,
  );
  if (task.done) {
    try {
      await undoTask(task);
      logInfo(`[task-action] undo completed — page="${task.page}" pos=${task.position}`);
      onRefresh();
      return true;
    } catch (e: any) {
      logError(`[task-action] undo failed — page="${task.page}" pos=${task.position}: ${e.message || e}`);
      showError(`Failed: ${e.message}`);
      return false;
    }
  }
  try {
    await markTaskDone(task);
    logInfo(`[task-action] mark done completed — page="${task.page}" pos=${task.position}`);
    showUndo(`${task.text.slice(0, 40)}${task.text.length > 40 ? '…' : ''} marked done`, async () => {
      try { await undoTask(task); } catch {}
      onRefresh();
    });
    onRefresh();
    return true;
  } catch (e: any) {
    logError(`[task-action] mark done failed — page="${task.page}" pos=${task.position}: ${e.message || e}`);
    showError(`Failed: ${e.message}`);
    return false;
  }
}
