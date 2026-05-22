import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createRemoteJWKSet, jwtVerify } from 'jose';

import { publicEnv } from '@/lib/public-env';
import { STUDYCUE_COOKIE } from '@/lib/session';

const firebaseProjectId = publicEnv('FIREBASE_PROJECT_ID');
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAppArea = pathname === '/app' || pathname.startsWith('/app/');

  if (!isAppArea) {
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
