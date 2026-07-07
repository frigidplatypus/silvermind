import { Preferences } from '@capacitor/preferences';

export const PENDING_APP_INTENT_KEY = 'silvermind_pending_app_intent';

export interface PendingAppIntent {
  intentName: string;
  parameters?: Record<string, unknown>;
}

export const SiriPlugin = {
  donate: async (_opts: {
    intentName: string;
    suggestedPhrase: string;
    parameters: Record<string, unknown>;
  }): Promise<void> => {
    // App Shortcuts are registered natively on iOS.
  },

  async consumePendingIntent(): Promise<PendingAppIntent | null> {
    const stored = await Preferences.get({ key: PENDING_APP_INTENT_KEY });
    if (!stored.value) return null;

    await Preferences.remove({ key: PENDING_APP_INTENT_KEY });

    try {
      return JSON.parse(stored.value) as PendingAppIntent;
    } catch {
      return null;
    }
  },

  async clearPendingIntent(): Promise<void> {
    await Preferences.remove({ key: PENDING_APP_INTENT_KEY });
  },
};
