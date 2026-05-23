import { NextResponse } from 'next/server';

/**
 * Firebase auth state is client-initialized in `WebAuthProvider`.
 * Do not block `/app` here based on a cookie, otherwise `/login -> /app`
 * can loop when the client has a Firebase user but the edge cookie is stale
 * or missing.
 */
export function proxy() {
  return NextResponse.next();
}

export const config = {
  matcher: ['/app', '/app/:path*'],
};
