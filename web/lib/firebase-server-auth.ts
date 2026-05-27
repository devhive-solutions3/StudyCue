import { getFirebasePublicConfig } from '@/lib/public-env';
import { STUDYCUE_COOKIE } from '@/lib/session';

export type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  emailVerified: boolean;
};

export type FirebaseTokenVerifyDebug = {
  method: 'identitytoolkit';
  firebaseApiKeyPresent: boolean;
  projectId: string;
  status?: number;
  firebaseCode?: string;
  detail: string;
};

const DEFAULT_FIREBASE_PROJECT_ID = 'studycue-3d831';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyDhU0u21HwVeyush_UdPDKNBUj2ge6iLhk';
const IS_DEV = process.env.NODE_ENV !== 'production';

type IdentityToolkitLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
    displayName?: string;
    photoUrl?: string;
    emailVerified?: boolean;
  }>;
};

function getFirebaseProjectId(): string {
  const fromPublicConfig = getFirebasePublicConfig().projectId;
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    fromPublicConfig ||
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

function getFirebaseApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY?.trim() ||
    getFirebasePublicConfig().apiKey ||
    DEFAULT_FIREBASE_API_KEY
  );
}

function normalizeBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();
  if (!token) return null;
  return token.length <= 4096 ? token : null;
}

export function readBearerToken(request: Request): string | null {
  return normalizeBearerToken(request.headers.get('authorization'));
}

export async function verifyFirebaseIdTokenDetailed(idToken: string): Promise<{
  user: VerifiedFirebaseUser | null;
  debug: FirebaseTokenVerifyDebug;
}> {
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  const debug: FirebaseTokenVerifyDebug = {
    method: 'identitytoolkit',
    firebaseApiKeyPresent: Boolean(apiKey),
    projectId,
    detail: '',
  };

  if (IS_DEV) {
    console.info('verifyFirebaseIdToken', {
      idTokenPresent: Boolean(idToken?.trim()),
      firebaseApiKeyPresent: debug.firebaseApiKeyPresent,
      projectId: projectId || '(none)',
      method: 'identitytoolkit',
    });
  }

  if (!idToken?.trim()) {
    debug.detail = 'Missing ID token';
    return { user: null, debug };
  }

  if (!apiKey) {
    debug.detail = 'Identity Toolkit verification failed: API key missing';
    if (IS_DEV) console.warn('Identity Toolkit token verification failed', debug.detail);
    return { user: null, debug };
  }

  try {
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      },
    );

    debug.status = response.status;

    if (IS_DEV) {
      console.info('Identity Toolkit verification response', {
        status: response.status,
        method: 'identitytoolkit',
      });
    }

    if (!response.ok) {
      const errBody = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      const firebaseCode = errBody?.error?.message;
      debug.firebaseCode = firebaseCode;
      debug.detail = firebaseCode
        ? `Identity Toolkit verification failed: ${firebaseCode}`
        : `Identity Toolkit verification failed: HTTP ${response.status}`;
      if (IS_DEV) {
        console.warn('Identity Toolkit token verification failed', {
          status: response.status,
          code: firebaseCode,
          method: 'identitytoolkit',
        });
      }
      return { user: null, debug };
    }

    const data = (await response.json()) as IdentityToolkitLookupResponse;
    const user = data.users?.[0];
    if (!user?.localId) {
      debug.detail = 'Identity Toolkit verification failed: user not found in lookup response';
      if (IS_DEV) console.warn('Identity Toolkit token verification failed', debug.detail);
      return { user: null, debug };
    }

    if (IS_DEV) {
      console.info('Identity Toolkit token verification succeeded', {
        method: 'identitytoolkit',
        uid: user.localId,
      });
    }

    return {
      user: {
        uid: user.localId,
        email: user.email ?? null,
        name: user.displayName ?? null,
        picture: user.photoUrl ?? null,
        emailVerified: Boolean(user.emailVerified),
      },
      debug: { ...debug, detail: 'verified' },
    };
  } catch (error) {
    debug.detail = 'Identity Toolkit verification failed: network or server error';
    if (IS_DEV) {
      console.warn('Identity Toolkit token verification failed', {
        method: 'identitytoolkit',
        error,
      });
    }
    return { user: null, debug };
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const { user } = await verifyFirebaseIdTokenDetailed(idToken);
  return user;
}

function readSessionCookieToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  for (const entry of cookieHeader.split(';')) {
    const [rawName, ...rawValue] = entry.trim().split('=');
    if (rawName !== STUDYCUE_COOKIE) continue;
    const token = rawValue.join('=').trim();
    return token || null;
  }
  return null;
}

export async function requireFirebaseAuth(request: Request): Promise<VerifiedFirebaseUser | null> {
  const bearerToken = readBearerToken(request);
  if (bearerToken) return verifyFirebaseIdToken(bearerToken);

  const cookieToken = readSessionCookieToken(request);
  if (!cookieToken) return null;
  return verifyFirebaseIdToken(cookieToken);
}
