import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let app;
if (getApps().length === 0) {
  app = initializeApp({
    projectId: firebaseConfig.projectId,
  });
} else {
  app = getApp();
}

export const adminDb = getFirestore(app);

if (firebaseConfig.firestoreDatabaseId) {
  try {
    adminDb.settings({ databaseId: firebaseConfig.firestoreDatabaseId });
    console.log('[FIREBASE ADMIN] databaseId set in settings:', firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.warn('[FIREBASE ADMIN] Failed to set databaseId settings:', err);
  }
}
