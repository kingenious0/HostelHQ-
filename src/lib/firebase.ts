
// Client-side Firebase SDK (no Admin SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
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
// Initialize Firestore with settings
let firestoreDb;
try {
  if (typeof window !== 'undefined' && shouldEnablePersistence()) {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    });
  } else {
    firestoreDb = getFirestore(app);
  }
} catch (e) {
  // Fallback if initialization fails (e.g. already initialized)
  console.warn("Firestore initialization warning:", e);
  firestoreDb = getFirestore(app);
}

export const db = firestoreDb;

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
