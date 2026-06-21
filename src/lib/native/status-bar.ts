export async function setDarkStyle(): Promise<void> {
  try {
    const { StatusBar } = await import('@capacitor/status-bar') as any;
    await StatusBar.setStyle({ style: 'DARK' });
  } catch { /* no status bar available */ }
}

export async function setLightStyle(): Promise<void> {
  try {
    const { StatusBar } = await import('@capacitor/status-bar') as any;
    await StatusBar.setStyle({ style: 'LIGHT' });
  } catch { /* no status bar available */ }
}

export async function setBackgroundColor(color: string): Promise<void> {
  try {
    const { StatusBar } = await import('@capacitor/status-bar') as any;
    await StatusBar.setBackgroundColor({ color });
  } catch { /* no status bar available */ }
}

export async function show(): Promise<void> {
  try {
    const { StatusBar } = await import('@capacitor/status-bar') as any;
    await StatusBar.show();
  } catch { /* no status bar available */ }
}

export async function hide(): Promise<void> {
  try {
    const { StatusBar } = await import('@capacitor/status-bar') as any;
    await StatusBar.hide();
  } catch { /* no status bar available */ }
}
