import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

type VerifiedFirebaseUser = {
  uid: string;
  email: string | null;
};

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
const IS_DEV = process.env.NODE_ENV !== 'production';

type FirebaseJwtPayload = JWTPayload & {
  user_id?: string;
  email?: string;
};

function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID?.trim() ||
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    ''
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

export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser | null> {
  const projectId = getFirebaseProjectId();
  if (!projectId || !idToken?.trim()) return null;

  try {
    const { payload } = await jwtVerify(idToken, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
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
    if (IS_DEV) console.warn('Firebase ID token verification failed', error);
    return null;
  }
}

export async function requireFirebaseAuth(request: Request): Promise<VerifiedFirebaseUser | null> {
  const token = readBearerToken(request);
  if (!token) return null;
  return verifyFirebaseIdToken(token);
}
