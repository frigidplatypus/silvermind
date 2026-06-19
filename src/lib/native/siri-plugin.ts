// Stub for Siri Shortcuts Capacitor plugin
// Replace with actual @capacitor-community/siri-shortcuts at integration time

export const SiriPlugin = {
  donate: async (_opts: {
    intentName: string;
    suggestedPhrase: string;
    parameters: Record<string, unknown>;
  }): Promise<void> => {
    // No-op: Siri only available in Capacitor iOS runtime
  },
};
