try {
  importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDKWorker.js");
} catch (e) {
  console.warn("OneSignal Worker offline or blocked:", e);
}
