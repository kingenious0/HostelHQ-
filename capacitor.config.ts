import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hostelhq.app',
  appName: 'HostelHQ',
  webDir: 'out',
  server: {
    // This points to your deployed web app. Update if you change domains.
    url: 'https://hostel-hq.vercel.app',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0, // We'll control this manually for video
      launchAutoHide: false, // Don't auto-hide, video will control it
      backgroundColor: '#0F172A', // Dark background matching your app theme
      showSpinner: false, // Hide spinner for video
      splashFullScreen: true,
      splashImmersive: true,
      launchFadeOutDuration: 300,
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
