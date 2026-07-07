// Siri Shortcuts integration via Capacitor plugin
// Provides intent registration for voice-triggered task creation and view navigation

export interface SiriIntent {
  name: string;
  title: string;
  description: string;
  suggestedPhrase: string;
  parameters?: Record<string, unknown>;
}

export interface IncomingIntent {
  intentName: string;
  parameters?: Record<string, unknown>;
}

const addTaskIntent: SiriIntent = {
  name: 'AddTaskIntent',
  title: 'Add Task',
  description: 'Create a new task in Silvermind',
  suggestedPhrase: 'Add a task in Silvermind',
  parameters: {
    title: { type: 'string', description: 'Task title' },
  },
};

const openInboxIntent: SiriIntent = {
  name: 'OpenInboxIntent',
  title: 'Open Inbox',
  description: 'Open the Silvermind inbox',
  suggestedPhrase: 'Show me my tasks in Silvermind',
};

const openTodayIntent: SiriIntent = {
  name: 'OpenTodayIntent',
  title: 'Open Today',
  description: "Open Silvermind's Today view",
  suggestedPhrase: "Show me today's tasks in Silvermind",
};

export const allIntents: SiriIntent[] = [addTaskIntent, openInboxIntent, openTodayIntent];

export async function donateIntent(intent: SiriIntent): Promise<void> {
  try {
    // Using @capacitor-community/siri-shortcuts or equivalent
    // The actual plugin call depends on the installed plugin
    // This is a typed wrapper that can be swapped at integration time
    const CapsSiri = (await import('./siri-plugin')).SiriPlugin;
    if (CapsSiri?.donate) {
      await CapsSiri.donate({
        intentName: intent.name,
        suggestedPhrase: intent.suggestedPhrase,
        parameters: intent.parameters ?? {},
      });
    }
  } catch {
    // Siri integration is non-critical; fail silently if unavailable
  }
}

export async function donateAllIntents(): Promise<void> {
  for (const intent of allIntents) {
    await donateIntent(intent);
  }
}

export function handleIncomingIntent(
  callback: (intentName: string, parameters?: Record<string, unknown>) => void,
): () => void {
  const listener = ((event: CustomEvent) => {
    callback(event.detail?.intentName, event.detail?.parameters);
  }) as EventListener;

  window.addEventListener('appIntentReceived', listener);
  return () => window.removeEventListener('appIntentReceived', listener);
}

export async function consumePendingIntent(): Promise<IncomingIntent | null> {
  try {
    const CapsSiri = (await import('./siri-plugin')).SiriPlugin;
    if (!CapsSiri?.consumePendingIntent) return null;
    return (await CapsSiri.consumePendingIntent()) as IncomingIntent | null;
  } catch {
    return null;
  }
}
