
// Client-side Firebase SDK (no Admin SDK)
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

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

// Enable persistence
if (typeof window !== 'undefined' && firebaseConfig.apiKey) {
    try {
        enableIndexedDbPersistence(db)
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                // Multiple tabs open, persistence can only be enabled in one tab at a time.
                console.warn('Firestore persistence failed: multiple tabs open.');
            } else if (err.code === 'unimplemented') {
                // The current browser does not support all of the
                // features required to enable persistence
                console.warn('Firestore persistence not available in this browser.');
            } else {
                 console.error("An error occurred while enabling Firestore persistence:", err);
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
