import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth } from '@firebase/auth';
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';

const {
  EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID,
} = process.env;

// Firebase client config is public by design for web/mobile apps.
// The sensitive boundary is enforced by Firebase Auth and Security Rules,
// unlike provider API secrets such as Gemini keys which must stay server-side.

if (
  !EXPO_PUBLIC_FIREBASE_API_KEY ||
  !EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ||
  !EXPO_PUBLIC_FIREBASE_PROJECT_ID ||
  !EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ||
  !EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
  !EXPO_PUBLIC_FIREBASE_APP_ID
) {
  throw new Error(
    'Missing Firebase environment variables. Copy .env.example to .env and fill in your Firebase config.'
  );
}

const firebaseConfig = {
  apiKey: EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: EXPO_PUBLIC_FIREBASE_APP_ID,
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

const auth = (() => {
  try {
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
})();

const db = getFirestore(app);

export { auth, app, db };
