import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { STUDYCUE_COOKIE } from './lib/session';

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/app')) {
    const sessionCookie = request.cookies.get(STUDYCUE_COOKIE)?.value?.trim();
    if (!sessionCookie) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
