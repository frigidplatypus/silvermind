function isDarkTheme(): boolean {
  if (typeof document !== 'undefined') {
    const theme = document.documentElement.getAttribute('data-theme');
    if (theme === 'dark') return true;
    if (theme === 'light') return false;
  }

  return typeof window !== 'undefined'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : false;
}

export async function setDarkStyle(): Promise<void> {
  try {
    const { StatusBar } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.setStyle({ style: 'DARK' });
  } catch {
    /* no status bar available */
  }
}

export async function configureDefaultIOSStatusBar(): Promise<void> {
  try {
    const { StatusBar } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.show();
    await StatusBar.setStyle({ style: isDarkTheme() ? 'DARK' : 'LIGHT' });
  } catch {
    /* no status bar available */
  }
}

export async function setLightStyle(): Promise<void> {
  try {
    const { StatusBar } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.setStyle({ style: 'LIGHT' });
  } catch {
    /* no status bar available */
  }
}

export async function show(): Promise<void> {
  try {
    const { StatusBar } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.show();
  } catch {
    /* no status bar available */
  }
}

export async function hide(): Promise<void> {
  try {
    const { StatusBar } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.hide();
  } catch {
    /* no status bar available */
  }
}

export async function syncThemeStatusBar(): Promise<void> {
  try {
    const { StatusBar } = (await import('@capacitor/status-bar')) as any;
    await StatusBar.show();
    await StatusBar.setStyle({ style: isDarkTheme() ? 'DARK' : 'LIGHT' });
  } catch {
    /* no status bar available */
  }
}
