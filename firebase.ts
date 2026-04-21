// firebase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';
import { Platform } from 'react-native';

type FirebaseConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
};

const productionFirebaseConfig: FirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_PROD_FIREBASE_API_KEY || 'AIzaSyDGaAN-Fg1mK3KZANo88t__OEoJA8SJAD0',
  authDomain: process.env.EXPO_PUBLIC_PROD_FIREBASE_AUTH_DOMAIN || 'local-list-wski21.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_PROD_FIREBASE_PROJECT_ID || 'local-list-wski21',
  storageBucket: process.env.EXPO_PUBLIC_PROD_FIREBASE_STORAGE_BUCKET || 'local-list-wski21.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_PROD_FIREBASE_MESSAGING_SENDER_ID || '280253430618',
  appId: process.env.EXPO_PUBLIC_PROD_FIREBASE_APP_ID || '1:280253430618:web:f1110d0f205e619fea9163',
  measurementId: process.env.EXPO_PUBLIC_PROD_FIREBASE_MEASUREMENT_ID || 'G-P839RQT0W8',
};

const developmentFirebaseConfig: FirebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_DEV_FIREBASE_API_KEY || 'TODO_DEV_API_KEY',
  authDomain: process.env.EXPO_PUBLIC_DEV_FIREBASE_AUTH_DOMAIN || 'TODO_DEV_AUTH_DOMAIN',
  projectId: process.env.EXPO_PUBLIC_DEV_FIREBASE_PROJECT_ID || 'TODO_DEV_PROJECT_ID',
  storageBucket: process.env.EXPO_PUBLIC_DEV_FIREBASE_STORAGE_BUCKET || 'TODO_DEV_STORAGE_BUCKET',
  messagingSenderId: process.env.EXPO_PUBLIC_DEV_FIREBASE_MESSAGING_SENDER_ID || 'TODO_DEV_SENDER_ID',
  appId: process.env.EXPO_PUBLIC_DEV_FIREBASE_APP_ID || 'TODO_DEV_APP_ID',
  measurementId: process.env.EXPO_PUBLIC_DEV_FIREBASE_MEASUREMENT_ID || undefined,
};

function hasCompleteFirebaseConfig(config: FirebaseConfig): boolean {
  return [
    config.apiKey,
    config.authDomain,
    config.projectId,
    config.storageBucket,
    config.messagingSenderId,
    config.appId,
  ].every((value) => value && !String(value).startsWith('TODO_'));
}

const getFirebaseConfig = (): FirebaseConfig => {
  const env = process.env.EXPO_PUBLIC_APP_ENV || 'production';

  if (env === 'development' && hasCompleteFirebaseConfig(developmentFirebaseConfig)) {
    return developmentFirebaseConfig;
  }

  if (env === 'development' && __DEV__) {
    console.warn(
      '[firebase] Development environment requested, but dev Firebase credentials are missing. Falling back to production Firebase config.'
    );
  }

  return productionFirebaseConfig;
};

const firebaseConfig = getFirebaseConfig();

const app = initializeApp(firebaseConfig);
const auth =
  Platform.OS === 'web'
    ? getAuth(app)
    : (() => {
      try {
        return initializeAuth(app, {
          persistence: getReactNativePersistence(AsyncStorage),
        });
      } catch {
        // If Auth is already initialized (e.g., during fast refresh), reuse it.
        return getAuth(app);
      }
    })();
const db = getFirestore(app);
const functions = getFunctions(app);

export { app, auth, db, functions };
