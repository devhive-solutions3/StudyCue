import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

/** Inline for Edge/proxy bundle — do not import from @/lib (Vercel unsupported module error). */
const STUDYCUE_COOKIE = 'studycue_fb_id';

/** Public project id — same fallback as `firebase-client` when Vercel env is missing. */
const FIREBASE_PROJECT_ID_FALLBACK = 'studycue-3d831';

function readFirebaseProjectId(): string {
  return (
    process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ??
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??
    FIREBASE_PROJECT_ID_FALLBACK
  ).trim();
}

const firebaseProjectId = readFirebaseProjectId();
const firebaseIssuer = firebaseProjectId
  ? `https://securetoken.google.com/${firebaseProjectId}`
  : null;
const firebaseJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

async function validateIdToken(idToken: string | undefined): Promise<boolean> {
  if (!idToken || !firebaseProjectId || !firebaseIssuer) return false;
  try {
    await jwtVerify(idToken, firebaseJwks, {
      issuer: firebaseIssuer,
      audience: firebaseProjectId,
    });
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname !== '/app' && !pathname.startsWith('/app/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get(STUDYCUE_COOKIE)?.value;
  const ok = await validateIdToken(token);

  if (!ok) {
    const login = new URL('/login', request.url);
    login.searchParams.set('next', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app', '/app/:path*'],
};
