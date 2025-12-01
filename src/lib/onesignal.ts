/**
 * OneSignal Push Notification Configuration
 * Uses window.OneSignal API loaded via script tag
 */

declare global {
  interface Window {
    OneSignal?: any;
    OneSignalDeferred?: any[];
  }
}

let isInitialized = false;

/**
 * Wait for OneSignal to be loaded
 */
function waitForOneSignal(): Promise<any> {
  return new Promise((resolve) => {
    if (window.OneSignal) {
      resolve(window.OneSignal);
    } else {
      const checkInterval = setInterval(() => {
        if (window.OneSignal) {
          clearInterval(checkInterval);
          resolve(window.OneSignal);
        }
      }, 100);
    }
  });
}

/**
 * Initialize OneSignal (already done in layout.tsx, this just waits for it)
 */
export async function initOneSignal() {
  if (typeof window === 'undefined') return;
  
  try {
    // Just wait for OneSignal to be ready
    await waitForOneSignal();
    isInitialized = true;
    console.log('[OneSignal] Ready');
  } catch (error) {
    console.error('[OneSignal] Error waiting for initialization:', error);
  }
}

/**
 * Request notification permission and subscribe
 */
export async function subscribeToNotifications(): Promise<string | null> {
  try {
    const OneSignal = await waitForOneSignal();
    
    // Show native browser permission prompt
    await OneSignal.Slidedown.promptPush();
    
    // Wait a bit for user to accept
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get subscription status
    const isPushEnabled = await OneSignal.User.PushSubscription.optedIn;
    
    if (isPushEnabled) {
      const playerId = OneSignal.User.PushSubscription.id;
      console.log('[OneSignal] Subscribed with ID:', playerId);
      return playerId || null;
    } else {
      console.log('[OneSignal] User denied permission');
      return null;
    }
  } catch (error) {
    console.error('[OneSignal] Subscribe error:', error);
    return null;
  }
}

/**
 * Get current subscription ID
 */
export async function getPlayerId(): Promise<string | null> {
  try {
    const OneSignal = await waitForOneSignal();
    const playerId = await OneSignal.User.PushSubscription.id;
    return playerId;
  } catch (error) {
    console.error('[OneSignal] Error getting player ID:', error);
    return null;
  }
}

/**
 * Check if notifications are enabled
 */
export async function isNotificationEnabled(): Promise<boolean> {
  try {
    const OneSignal = await waitForOneSignal();
    return await OneSignal.User.PushSubscription.optedIn;
  } catch (error) {
    console.error('[OneSignal] Error checking notification status:', error);
    return false;
  }
}

/**
 * Set external user ID (link OneSignal to your Firebase user ID)
 */
export async function setExternalUserId(userId: string) {
  try {
    const OneSignal = await waitForOneSignal();
    await OneSignal.login(userId);
    console.log('[OneSignal] External user ID set:', userId);
  } catch (error) {
    console.error('[OneSignal] Error setting external user ID:', error);
  }
}

/**
 * Remove external user ID (on logout)
 */
export async function removeExternalUserId() {
  try {
    const OneSignal = await waitForOneSignal();
    await OneSignal.logout();
    console.log('[OneSignal] External user ID removed');
  } catch (error) {
    console.error('[OneSignal] Error removing external user ID:', error);
  }
}
