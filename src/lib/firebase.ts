
// Client-side Firebase SDK (no Admin SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, clearIndexedDbPersistence } from 'firebase/firestore';
// Lazy read of client setting for persistence; safe on server as it checks window
function shouldEnablePersistence(): boolean {
  if (typeof window === 'undefined') return true; // default on SSR
  try {
    const raw = localStorage.getItem('hostelhq:settings');
    if (!raw) return true;
    const parsed = JSON.parse(raw);
    return parsed?.data?.firestorePersistence !== false;
  } catch {
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
