// Siri Shortcuts integration via Capacitor plugin
// Provides intent registration for voice-triggered task creation and view navigation

export interface SiriIntent {
  name: string;
  title: string;
  description: string;
  suggestedPhrase: string;
  parameters?: Record<string, unknown>;
}

const addTaskIntent: SiriIntent = {
  name: 'AddTaskIntent',
  title: 'Add Task',
  description: 'Create a new task in Prowl',
  suggestedPhrase: 'Add a task in Prowl',
  parameters: {
    title: { type: 'string', description: 'Task title' },
  },
};

const openInboxIntent: SiriIntent = {
  name: 'OpenInboxIntent',
  title: 'Open Inbox',
  description: 'Open the Prowl inbox',
  suggestedPhrase: 'Show me my tasks in Prowl',
};

const openTodayIntent: SiriIntent = {
  name: 'OpenTodayIntent',
  title: 'Open Today',
  description: "Open Prowl's Today view",
  suggestedPhrase: "Show me today's tasks in Prowl",
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
): void {
  // Listen for incoming Siri intent from the Capacitor app delegate
  window.addEventListener('appIntentReceived', ((event: CustomEvent) => {
    callback(event.detail?.intentName, event.detail?.parameters);
  }) as EventListener);
}
