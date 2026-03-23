import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, inMemoryPersistence } from 'firebase/auth';

const {
  EXPO_PUBLIC_FIREBASE_API_KEY,
  EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  EXPO_PUBLIC_FIREBASE_APP_ID,
} = process.env;

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

const auth = initializeAuth(app, {
  persistence: inMemoryPersistence
});

export { auth };
