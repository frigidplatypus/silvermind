export async function startSbtaskService(): Promise<void> {
  try {
    const { Plugins } = await import('@capacitor/core') as any;
    await Plugins.SbtaskPlugin.start();
  } catch { /* plugin not available */ }
}
