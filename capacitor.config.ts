import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.silvermind.app',
  appName: 'Silvermind',
  webDir: 'dist',
  server: {
    allowNavigation: ['*'],
    cleartext: true,
  },
  ios: {
    scheme: 'Silvermind',
    contentInset: 'automatic',
    prefersStatusBarHidden: false,
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
    },
  },
};

export default config;
