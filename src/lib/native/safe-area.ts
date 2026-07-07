import { Capacitor } from '@capacitor/core';
import { SafeArea } from 'capacitor-plugin-safe-area';
import { logInfo, logWarn } from '$lib/helpers/logger';

type Insets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

function applyInsets(insets: Insets): void {
  const root = document.documentElement.style;
  root.setProperty('--safe-area-top', `${insets.top}px`);
  root.setProperty('--safe-area-right', `${insets.right}px`);
  root.setProperty('--safe-area-bottom', `${insets.bottom}px`);
  root.setProperty('--safe-area-left', `${insets.left}px`);
}

export async function initSafeArea(): Promise<void> {
  if (typeof window === 'undefined') return;

  const platform = Capacitor.getPlatform();
  if (platform !== 'ios' && platform !== 'android') return;

  try {
    const { insets } = await SafeArea.getSafeAreaInsets();
    applyInsets(insets);
    logInfo(
      `[safe-area] initial insets top=${insets.top} right=${insets.right} bottom=${insets.bottom} left=${insets.left}`,
    );

    await SafeArea.addListener('safeAreaChanged', ({ insets }) => {
      applyInsets(insets);
      logInfo(
        `[safe-area] updated insets top=${insets.top} right=${insets.right} bottom=${insets.bottom} left=${insets.left}`,
      );
    });
  } catch (error: any) {
    logWarn(
      `[safe-area] plugin unavailable, falling back to CSS env(): ${error?.message || error}`,
    );
  }
}
