import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { getBetaSignupsEnabled } from '@/lib/beta-config-server';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { trackProfileLoginAnalytics, trackProfileSignupAnalytics } from '@/lib/analytics-auth';
import { buildNewUserProfile } from '@/lib/user-plan';
import {
  COOKIES_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
  type LegalAcceptancePayload,
} from '@/lib/legal-consent';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  if (!readFirebaseAdminStatus().configured) {
    return NextResponse.json({ error: 'Admin data source not configured.' }, { status: 500 });
  }

  const db = getFirebaseAdminDb();
  const ref = db.doc(`users/${viewer.uid}`);
  const nowIso = new Date().toISOString();
  const body = await request.json().catch(() => ({})) as { legalAcceptance?: unknown };
  const legalAcceptance = parseLegalAcceptance(body.legalAcceptance);

  let isNewUser = false;
  let profileForAnalytics: Record<string, unknown> | null = null;

  try {
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);

      if (!snapshot.exists) {
        if (!legalAcceptance) {
          throw new LegalAcceptanceRequiredError();
        }
        isNewUser = true;
        const betaSignupsEnabled = await getBetaSignupsEnabled();
        const profile = buildNewUserProfile({
          uid: viewer.uid,
          email: viewer.email ?? null,
          displayName: viewer.name ?? null,
          photoURL: viewer.picture ?? null,
          plan: betaSignupsEnabled ? 'beta' : 'free',
        });
        profileForAnalytics = profile;

        transaction.set(
          ref,
          {
            ...profile,
            ...legalAcceptanceFields(),
            serverTimestamp: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return;
      }

      const current = (snapshot.data() ?? {}) as Record<string, unknown>;
      profileForAnalytics = {
        ...current,
        uid: viewer.uid,
        lastLoginAt: nowIso,
      };
      transaction.set(
        ref,
        {
          uid: viewer.uid,
          email: viewer.email ?? (typeof current.email === 'string' ? current.email : null),
          displayName:
            typeof current.displayName === 'string' && current.displayName.trim()
              ? current.displayName
              : viewer.name ?? null,
          photoURL:
            typeof current.photoURL === 'string' && current.photoURL.trim()
              ? current.photoURL
              : viewer.picture ?? null,
          lastLoginAt: nowIso,
          updatedAt: nowIso,
          ...(legalAcceptance ? legalAcceptanceFields() : {}),
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  } catch (error) {
    if (error instanceof LegalAcceptanceRequiredError) {
      return NextResponse.json({ error: error.message }, { status: 428 });
    }
    throw error;
  }

  if (profileForAnalytics) {
    if (isNewUser) {
      void trackProfileSignupAnalytics({
        uid: viewer.uid,
        profile: profileForAnalytics,
        signupSource: null,
      }).catch(() => {});
    } else {
      void trackProfileLoginAnalytics({
        uid: viewer.uid,
        profile: profileForAnalytics,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ ok: true });
}

class LegalAcceptanceRequiredError extends Error {
  constructor() {
    super('Please read and accept the Terms of Use and Privacy Policy to continue.');
  }
}

function parseLegalAcceptance(value: unknown): LegalAcceptancePayload | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<LegalAcceptancePayload>;
  if (
    input.termsAccepted !== true ||
    input.privacyAccepted !== true ||
    input.adsDisclosureAccepted !== true ||
    input.termsVersion !== TERMS_VERSION ||
    input.privacyVersion !== PRIVACY_VERSION ||
    input.cookiesVersion !== COOKIES_VERSION
  ) {
    return null;
  }
  return input as LegalAcceptancePayload;
}

function legalAcceptanceFields() {
  return {
    termsAccepted: true,
    termsAcceptedAt: FieldValue.serverTimestamp(),
    privacyAccepted: true,
    privacyAcceptedAt: FieldValue.serverTimestamp(),
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    cookiesVersion: COOKIES_VERSION,
    adsDisclosureAccepted: true,
    adsDisclosureAcceptedAt: FieldValue.serverTimestamp(),
  };
}
