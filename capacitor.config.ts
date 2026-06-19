import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.prowl.app',
  appName: 'Prowl',
  webDir: 'dist',
  server: {
    allowNavigation: ['*'],
    cleartext: true,
  },
  ios: {
    scheme: 'Prowl',
    contentInset: 'automatic',
    prefersStatusBarHidden: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: false,
    },
  },
};

export default config;
