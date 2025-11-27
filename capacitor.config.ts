import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hostelhq.app',
  appName: 'HostelHQ',
  webDir: 'out',
  server: {
    // This points to your deployed web app. Update if you change domains.
    url: 'https://hostelhq.vercel.app',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0F172A', // Dark background matching your app theme
      showSpinner: true,
      spinnerColor: '#3B82F6', // Blue spinner
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK', // Light text on dark background
      backgroundColor: '#0F172A',
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Set to true for debugging
  },
};

export default config;
