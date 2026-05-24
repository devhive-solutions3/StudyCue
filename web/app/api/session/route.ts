import { NextResponse } from 'next/server';
import { verifyFirebaseIdToken } from '@/lib/firebase-server-auth';
import { STUDYCUE_COOKIE } from '@/lib/session';

const maxAgeSeconds = 60 * 60 * 24;

export async function POST(req: Request) {
  try {
    const { idToken } = (await req.json()) as { idToken?: string };
    if (!idToken?.length || idToken.length > 12000) {
      return NextResponse.json({ ok: false, error: 'Invalid token' }, { status: 400 });
    }
    const verified = await verifyFirebaseIdToken(idToken);
    if (!verified) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });

    const secure =
      process.env.NODE_ENV === 'production' ||
      process.env.VERCEL === '1' ||
      process.env.TRUST_COOKIE_SECURE === '1';

    res.cookies.set(STUDYCUE_COOKIE, idToken, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: maxAgeSeconds,
      secure,
    });

    return res;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const secure =
    process.env.NODE_ENV === 'production' ||
    process.env.VERCEL === '1' ||
    process.env.TRUST_COOKIE_SECURE === '1';

  res.cookies.set(STUDYCUE_COOKIE, '', {
    httpOnly: true,
    path: '/',
    maxAge: 0,
    secure,
    sameSite: 'lax',
  });
  return res;
}
