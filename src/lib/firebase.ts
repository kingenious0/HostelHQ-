
// Client-side Firebase SDK (no Admin SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, clearIndexedDbPersistence } from 'firebase/firestore';
import { getMessaging, isSupported as isMessagingSupported } from 'firebase/messaging';
// Lazy read of client setting for persistence; safe on server and in non-standard environments
function shouldEnablePersistence(): boolean {
  // On the server (or environments without a real window/localStorage),
  // default to enabling persistence and let the client decide later.
  if (typeof window === 'undefined') return true;

  try {
    const storage = typeof window.localStorage !== 'undefined' ? window.localStorage : null;
    if (!storage || typeof storage.getItem !== 'function') return true;

    const raw = storage.getItem('hostelhq:settings');
    if (!raw) return true;

    const parsed = JSON.parse(raw);
    return parsed?.data?.firestorePersistence !== false;
  } catch {
    // If anything goes wrong (including weird mocked localStorage),
    // fail open and keep persistence enabled rather than crashing SSR.
    return true;
  }
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check if all required environment variables are present
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    console.warn('Firebase configuration is missing. Make sure you have a .env file with all the required NEXT_PUBLIC_FIREBASE_... variables.');
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize Firebase Cloud Messaging (only on client-side and if supported)
let messagingInstance: ReturnType<typeof getMessaging> | null = null;

export const getMessagingInstance = async () => {
  if (typeof window === 'undefined') return null;
  
  try {
    const supported = await isMessagingSupported();
    if (!supported) {
      console.warn('Firebase Messaging is not supported in this browser');
      return null;
    }
    
    if (!messagingInstance) {
      messagingInstance = getMessaging(app);
    }
    return messagingInstance;
  } catch (error) {
    console.error('Error initializing Firebase Messaging:', error);
    return null;
  }
};

// Enable persistence based on client setting
if (typeof window !== 'undefined' && firebaseConfig.apiKey && shouldEnablePersistence()) {
    try {
        enableIndexedDbPersistence(db).catch(async (err) => {
            if (err.code === 'failed-precondition') {
                console.warn('Firestore persistence failed: multiple tabs open.');
            } else if (err.code === 'unimplemented') {
                console.warn('Firestore persistence not available in this browser.');
            } else if (err.code === 'unavailable' || err.message?.includes('Version change transaction was aborted')) {
                console.warn('Firestore persistence unavailable, attempting to clear IndexedDB cache…');
                try {
                    await clearIndexedDbPersistence(db);
                    console.info('Cleared cached Firestore data successfully after persistence failure.');
                } catch (clearError) {
                    console.error('Failed to clear Firestore IndexedDB cache.', clearError);
                }
            } else {
                console.error('An error occurred while enabling Firestore persistence:', err);
            }
        });
    } catch (e: any) {
        // This catch block is crucial for handling potential IndexedDB corruption errors.
        if (e.message?.includes('potential corruption')) {
            console.error("Firestore persistence could not be enabled due to potential IndexedDB corruption. This can sometimes be fixed by a hard refresh (Ctrl+Shift+R or Cmd+Shift+R). The app will continue to work online.");
        } else {
            console.error("An unexpected error occurred with Firebase persistence:", e);
        }
    }
}
