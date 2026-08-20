/**
 * Firebase Admin SDK Configuration
 * Used for server-side operations like sending push notifications
 */

import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    // Option 1: Using service account JSON (recommended for production)
    // Download from Firebase Console > Project Settings > Service Accounts > Generate new private key
    const serviceAccount: ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    initializeApp({
      credential: cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });

    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Firebase Admin initialization error:', error);
    
    // Fallback: Try without credentials (works in some environments)
    try {
      initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-9467663896-23071',
      });
      console.log('⚠️ Firebase Admin initialized without credentials (limited functionality)');
    } catch (fallbackError) {
      console.error('❌ Firebase Admin fallback initialization failed:', fallbackError);
    }
  }
}

export const adminDb = getFirestore();
export const adminAuth = getAuth();
