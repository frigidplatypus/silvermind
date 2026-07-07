import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ai.silvermind.app',
  appName: 'Silvermind',
  webDir: 'dist',
  ios: {
    scheme: 'Silvermind',
    contentInset: 'never',
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,
      style: 'LIGHT',
    },
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
