import admin from 'firebase-admin';

// Use a service account
const serviceAccount = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'demo-project',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || 'firebase-adminsdk-@demo-project.iam.gserviceaccount.com',
  privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://${serviceAccount.projectId}.firebaseio.com`
    });
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
