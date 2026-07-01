import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.silvermind.app',
  appName: 'Silvermind',
  webDir: 'dist',
  server: {
    url: 'http://127.0.0.1:7433',
    cleartext: true,
    allowNavigation: ['*'],
  },
  ios: {
    scheme: 'Silvermind',
    contentInset: 'automatic',
    prefersStatusBarHidden: false,
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
    },
  },
  android: {
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      launchAutoHide: true,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#488AFF',
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
  },
};

export default config;
