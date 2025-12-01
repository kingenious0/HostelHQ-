/**
 * OneSignal Push Notification Configuration
 * Uses window.OneSignal API loaded via script tag
 */

declare global {
  interface Window {
    OneSignal?: any;
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
 * Initialize OneSignal
 */
export async function initOneSignal() {
  if (typeof window === 'undefined') return;
  if (isInitialized) {
    console.log('[OneSignal] Already initialized');
    return;
  }

  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  
  if (!appId) {
    console.error('[OneSignal] Missing NEXT_PUBLIC_ONESIGNAL_APP_ID');
    return;
  }

  try {
    const OneSignal = await waitForOneSignal();
    
    await OneSignal.init({
      appId,
      allowLocalhostAsSecureOrigin: true,
    });

    isInitialized = true;
    console.log('[OneSignal] Initialized successfully');
  } catch (error) {
    console.error('[OneSignal] Initialization error:', error);
  }
}

/**
 * Request notification permission and subscribe
 */
export async function subscribeToNotifications(): Promise<string | null> {
  try {
    const OneSignal = await waitForOneSignal();
    
    // Show permission prompt
    await OneSignal.showSlidedownPrompt();
    
    // Wait a bit for user to accept
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get subscription status
    const subscription = await OneSignal.User.PushSubscription.optedIn;
    
    if (subscription) {
      const playerId = await OneSignal.User.PushSubscription.id;
      console.log('[OneSignal] Subscribed with ID:', playerId);
      return playerId;
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
