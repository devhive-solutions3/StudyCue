import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { NextResponse } from 'next/server';

import {
  readBearerToken,
  type VerifiedFirebaseUser,
  verifyFirebaseIdToken,
} from '@/lib/firebase-server-auth';
import { writeSecurityLog } from '@/lib/admin-log';
import { STUDYCUE_COOKIE } from '@/lib/session';

const IS_DEV = process.env.NODE_ENV !== 'production';

export type AdminAllowlist = {
  uids: Set<string>;
  emails: Set<string>;
};

function parseAllowlist(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function readCookieToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookiesByName = cookieHeader.split(';');
  for (const entry of cookiesByName) {
    const [rawName, ...rawValue] = entry.trim().split('=');
    if (rawName !== STUDYCUE_COOKIE) continue;
    const token = rawValue.join('=').trim();
    return token || null;
  }
  return null;
}

async function readSessionCookieUser(): Promise<VerifiedFirebaseUser | null> {
  const cookieStore = await cookies();
  const idToken = cookieStore.get(STUDYCUE_COOKIE)?.value?.trim();
  if (!idToken) return null;
  return verifyFirebaseIdToken(idToken);
}

async function readRequestUser(request: Request): Promise<VerifiedFirebaseUser | null> {
  const bearerToken = readBearerToken(request);
  if (bearerToken) return verifyFirebaseIdToken(bearerToken);

  const cookieToken = readCookieToken(request.headers.get('cookie'));
  if (!cookieToken) return null;
  return verifyFirebaseIdToken(cookieToken);
}

export function getAdminAllowlist(): AdminAllowlist {
  const singularAdminEmail = process.env.STUDYCUE_ADMIN_EMAIL?.trim();

  return {
    uids: new Set(parseAllowlist(process.env.STUDYCUE_ADMIN_UIDS)),
    emails: new Set(
      [
        ...parseAllowlist(process.env.STUDYCUE_ADMIN_EMAILS),
        ...(singularAdminEmail ? [singularAdminEmail] : []),
      ].map((email) => email.toLowerCase()),
    ),
  };
}

export function isAdminUid(uid: string | null | undefined): boolean {
  if (!uid) return false;
  return getAdminAllowlist().uids.has(uid.trim());
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminAllowlist().emails.has(email.trim().toLowerCase());
}

function isAdminUser(user: VerifiedFirebaseUser | null): boolean {
  if (!user) return false;
  return isAdminUid(user.uid) || isAdminEmail(user.email);
}

export async function requireAdminUser(options?: {
  nextPath?: string;
  onUnauthorized?: 'notFound';
}): Promise<VerifiedFirebaseUser> {
  const nextPath = options?.nextPath ?? '/admin';
  const user = await readSessionCookieUser();

  if (!user) {
    await writeSecurityLog({
      severity: 'warning',
      action: 'failed_admin_page_access',
      target: nextPath,
      category: 'admin',
      details: { reason: 'anonymous' },
    }).catch(() => {});
    if (IS_DEV) {
      console.info('[admin] blocked anonymous page request', {
        nextPath,
      });
    }
    notFound();
  }

  if (!isAdminUser(user)) {
    await writeSecurityLog({
      severity: 'warning',
      actorUid: user.uid,
      actorEmail: user.email,
      action: 'failed_admin_page_access',
      target: nextPath,
      category: 'admin',
      details: { reason: 'non_admin' },
    }).catch(() => {});
    if (IS_DEV) {
      console.info('[admin] blocked non-admin page request', {
        uid: user.uid,
        email: user.email,
        nextPath,
      });
    }

    notFound();
  }

  return user;
}

export async function assertAdminApiRequest(
  request: Request,
): Promise<VerifiedFirebaseUser | NextResponse> {
  const user = await readRequestUser(request);

  if (!user || !isAdminUser(user)) {
    await writeSecurityLog({
      severity: 'warning',
      actorUid: user?.uid ?? null,
      actorEmail: user?.email ?? null,
      action: 'failed_admin_api_access',
      target: new URL(request.url).pathname,
      category: 'admin',
      details: { reason: user ? 'non_admin' : 'anonymous' },
    }).catch(() => {});
    if (IS_DEV) {
      console.info('[admin] blocked api request', {
        path: new URL(request.url).pathname,
        uid: user?.uid ?? null,
        email: user?.email ?? null,
      });
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return user;
}
