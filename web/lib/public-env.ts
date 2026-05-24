/**
 * Public env names shared with Expo / Vercel (EXPO_PUBLIC_*).
 * Local web/.env.local may still use NEXT_PUBLIC_* — both are supported.
 */

const FIREBASE_KEYS = [
  'FIREBASE_API_KEY',
  'FIREBASE_AUTH_DOMAIN',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_STORAGE_BUCKET',
  'FIREBASE_MESSAGING_SENDER_ID',
  'FIREBASE_APP_ID',
] as const;

export type FirebasePublicEnvKey = (typeof FIREBASE_KEYS)[number];

export function publicEnv(name: FirebasePublicEnvKey | 'AI_PROXY_URL' | 'SITE_URL'): string {
  const expo = `EXPO_PUBLIC_${name}`;
  const next = `NEXT_PUBLIC_${name}`;
  return (process.env[expo] ?? process.env[next] ?? '').trim();
}

/**
 * File storage defaults to Firebase unless explicitly forced to local-only mode.
 * This avoids cross-device note links breaking when the mode flag is simply unset.
 */
export function publicFileStorageMode(): 'firebase' | 'local' {
  const raw = (
    process.env.EXPO_PUBLIC_FILE_STORAGE_MODE ??
    process.env.NEXT_PUBLIC_FILE_STORAGE_MODE ??
    ''
  )
    .trim()
    .toLowerCase();

  return raw === 'local' ? 'local' : 'firebase';
}

export function getFirebasePublicConfig() {
  return {
    apiKey: publicEnv('FIREBASE_API_KEY'),
    authDomain: publicEnv('FIREBASE_AUTH_DOMAIN'),
    projectId: publicEnv('FIREBASE_PROJECT_ID'),
    storageBucket: publicEnv('FIREBASE_STORAGE_BUCKET'),
    messagingSenderId: publicEnv('FIREBASE_MESSAGING_SENDER_ID'),
    appId: publicEnv('FIREBASE_APP_ID'),
  };
}

/** Keys forwarded in next.config `env` so client bundles receive EXPO_PUBLIC_* from Vercel. */
export function bridgedPublicEnvForNextConfig(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of FIREBASE_KEYS) {
    const val = publicEnv(key);
    if (!val) continue;
    out[`EXPO_PUBLIC_${key}`] = val;
    out[`NEXT_PUBLIC_${key}`] = val;
  }
  const proxy = publicEnv('AI_PROXY_URL');
  if (proxy) {
    out.EXPO_PUBLIC_AI_PROXY_URL = proxy;
    out.NEXT_PUBLIC_AI_PROXY_URL = proxy;
  }
  const site = publicEnv('SITE_URL');
  if (site) {
    out.EXPO_PUBLIC_SITE_URL = site;
    out.NEXT_PUBLIC_SITE_URL = site;
  }
  return out;
}
