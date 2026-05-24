import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

import { getFirebasePublicConfig } from '@/lib/public-env';

type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

const DEFAULT_FIREBASE_PROJECT_ID = 'studycue-3d831';
const DEFAULT_FIREBASE_API_KEY = 'AIzaSyDhU0u21HwVeyush_UdPDKNBUj2ge6iLhk';

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const IS_DEV = process.env.NODE_ENV !== 'production';

type FirebaseJwtPayload = JWTPayload & {
  user_id?: string;
  email?: string;
};

type IdentityToolkitLookupResponse = {
  users?: Array<{
    localId?: string;
    email?: string;
  }>;
};

function getFirebaseProjectId(): string {
  const fromPublicConfig = getFirebasePublicConfig().projectId;
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    fromPublicConfig ||
    DEFAULT_FIREBASE_PROJECT_ID
  );
}

function getFirebaseApiKey(): string {
  const fromPublicConfig = getFirebasePublicConfig().apiKey;
  return fromPublicConfig || DEFAULT_FIREBASE_API_KEY;
}

function logMissingServerAuthConfig() {
  if (!IS_DEV) return;
  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  if (!projectId && !apiKey) {
    console.warn('Firebase Admin credentials missing or invalid.');
  }
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

async function verifyViaJose(
  idToken: string,
  projectId: string,
): Promise<VerifiedFirebaseUser | null> {
  try {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      clockTolerance: 60,
    });
    const firebasePayload = payload as FirebaseJwtPayload;
    const uid =
      (typeof firebasePayload.user_id === 'string' && firebasePayload.user_id) ||
      (typeof firebasePayload.sub === 'string' && firebasePayload.sub) ||
      null;
    if (!uid) return null;

    return {
      uid,
      email: typeof firebasePayload.email === 'string' ? firebasePayload.email : null,
    };
  } catch (error) {
    if (IS_DEV) {
      const code =
        error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
      console.warn('Firebase ID token JWT verification failed', { code, projectId });
    }
    return null;
  }
}

async function verifyViaIdentityToolkit(
  idToken: string,
  apiKey: string,
): Promise<VerifiedFirebaseUser | null> {
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

    if (!response.ok) {
      if (IS_DEV) {
        const errBody = (await response.clone().json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        console.warn('Identity Toolkit token verification failed', {
          status: response.status,
          code: errBody?.error?.message,
        });
      }
      return null;
    }

    const data = (await response.json()) as IdentityToolkitLookupResponse;
    const user = data.users?.[0];
    if (!user?.localId) return null;

    return {
      uid: user.localId,
      email: user.email ?? null,
    };
  } catch (error) {
    if (IS_DEV) console.warn('Identity Toolkit token verification failed', error);
    return null;
  }
}

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  if (!idToken?.trim()) return null;

  const projectId = getFirebaseProjectId();
  const apiKey = getFirebaseApiKey();
  if (!projectId && !apiKey) {
    logMissingServerAuthConfig();
    return null;
  }

  if (projectId) {
    const viaJose = await verifyViaJose(idToken, projectId);
    if (viaJose) return viaJose;
  }

  if (apiKey) {
    return verifyViaIdentityToolkit(idToken, apiKey);
  }

  logMissingServerAuthConfig();
  return null;
}

export async function requireFirebaseAuth(request: Request): Promise<VerifiedFirebaseUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;
  return verifyFirebaseIdToken(token);
}
