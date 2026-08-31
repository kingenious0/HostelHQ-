/**
 * Firebase Admin SDK Configuration
 * Used for server-side operations like sending push notifications
 */

import { initializeApp, getApps, cert, getApp, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

/**
 * Checks if valid Firebase Admin service account credentials exist in the current environment.
 */
export function isFirebaseAdminConfigured(): boolean {
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = process.env.FIREBASE_PRIVATE_KEY;
  return Boolean(email && key && key.length > 50);
}

// Sanitize private key if present
function getCleanPrivateKey(): string | undefined {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!rawKey) return undefined;
  return rawKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '').trim();
}

// Initialize Firebase Admin SDK
function ensureFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-9467663896-23071';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getCleanPrivateKey();

  if (clientEmail && privateKey) {
    try {
      const serviceAccount: ServiceAccount = {
        projectId,
        clientEmail,
        privateKey,
      };

      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      });
    } catch (error) {
      console.error('❌ Firebase Admin credential initialization error:', error);
    }
  }

  // Fallback: limited app initialization
  try {
    return initializeApp({
      projectId,
    });
  } catch (fallbackError) {
    console.error('❌ Firebase Admin fallback initialization failed:', fallbackError);
    return null;
  }
}

// Ensure app initialized
ensureFirebaseAdminApp();

let _adminDb: Firestore | null = null;
let _adminAuth: Auth | null = null;

export function getAdminDb(): Firestore | null {
  if (!_adminDb && getApps().length > 0) {
    try {
      _adminDb = getFirestore();
    } catch (e) {
      console.warn("Could not get adminDb:", e);
    }
  }
  return _adminDb;
}

export function getAdminAuth(): Auth | null {
  if (!_adminAuth && getApps().length > 0) {
    try {
      _adminAuth = getAuth();
    } catch (e) {
      console.warn("Could not get adminAuth:", e);
    }
  }
  return _adminAuth;
}

// Safe proxy export for adminDb so imports never crash at module load time
export const adminDb: Firestore = new Proxy({} as Firestore, {
  get(target, prop, receiver) {
    const db = getAdminDb();
    if (!db) {
      throw new Error("Firebase Admin Firestore is not initialized or missing credentials");
    }
    const val = (db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(db);
    }
    return val;
  }
});

// Safe proxy export for adminAuth so imports never crash at module load time
export const adminAuth: Auth = new Proxy({} as Auth, {
  get(target, prop, receiver) {
    const auth = getAdminAuth();
    if (!auth) {
      throw new Error("Firebase Admin Auth is not initialized or missing credentials");
    }
    const val = (auth as any)[prop];
    if (typeof val === 'function') {
      return val.bind(auth);
    }
    return val;
  }
});

