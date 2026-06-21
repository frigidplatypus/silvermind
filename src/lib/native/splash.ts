export async function showSplash(): Promise<void> {
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen') as any;
    await SplashScreen.show({ fadeInDuration: 0 });
  } catch { /* no splash available */ }
}

export async function hideSplash(): Promise<void> {
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen') as any;
    await SplashScreen.hide({ fadeOutDuration: 300 });
  } catch { /* no splash available */ }
}
