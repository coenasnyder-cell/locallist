// firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ─── Environment-aware Firebase Config ──────────────────────────
// Support multiple Firebase projects: production (default) and development
// Set via EAS environment variables in eas.json for each build profile

const getFirebaseConfig = () => {
  // Environment variable set by EAS based on build profile
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'production';

  if (env === 'development') {
    // Development Firebase project
    return {
      apiKey: process.env.EXPO_PUBLIC_DEV_FIREBASE_API_KEY || "TODO_DEV_API_KEY",
      authDomain: process.env.EXPO_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN || "TODO_DEV_AUTH_DOMAIN",
      projectId: process.env.EXPO_PUBLIC_DEV_FIREBASE_PROJECT_ID || "TODO_DEV_PROJECT_ID",
      storageBucket: process.env.EXPO_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET || "TODO_DEV_STORAGE_BUCKET",
      messagingSenderId: process.env.EXPO_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID || "TODO_DEV_SENDER_ID",
      appId: process.env.EXPO_PUBLIC_DEV_FIREBASE_APP_ID || "TODO_DEV_APP_ID",
      measurementId: process.env.EXPO_PUBLIC_DEV_FIREBASE_MEASUREMENT_ID || undefined
    };
  }

  // Production Firebase project (default)
  return {
    apiKey: process.env.EXPO_PUBLIC_PROD_FIREBASE_API_KEY || "AIzaSyDGaAN-Fg1mK3KZANo88t__OEoJA8SJAD0",
    authDomain: process.env.EXPO_PUBLIC_PROD_FIREBASE_AUTH_DOMAIN || "local-list-wski21.firebaseapp.com",
    projectId: process.env.EXPO_PUBLIC_PROD_FIREBASE_PROJECT_ID || "local-list-wski21",
    storageBucket: process.env.EXPO_PUBLIC_PROD_FIREBASE_STORAGE_BUCKET || "local-list-wski21.firebasestorage.app",
    messagingSenderId: process.env.EXPO_PUBLIC_PROD_FIREBASE_MESSAGING_SENDER_ID || "280253430618",
    appId: process.env.EXPO_PUBLIC_PROD_FIREBASE_APP_ID || "1:280253430618:web:f1110d0f205e619fea9163",
    measurementId: process.env.EXPO_PUBLIC_PROD_FIREBASE_MEASUREMENT_ID || "G-P839RQT0W8"
  };
};

const firebaseConfig = getFirebaseConfig();

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
export { app, auth, db };
