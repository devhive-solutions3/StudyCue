import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { getBetaSignupsEnabled } from '@/lib/beta-config-server';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { buildNewUserProfile } from '@/lib/user-plan';

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

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);

    if (!snapshot.exists) {
      const betaSignupsEnabled = await getBetaSignupsEnabled();
      const profile = buildNewUserProfile({
        uid: viewer.uid,
        email: viewer.email ?? null,
        displayName: viewer.name ?? null,
        photoURL: viewer.picture ?? null,
        plan: betaSignupsEnabled ? 'beta' : 'free',
      });

      transaction.set(
        ref,
        {
          ...profile,
          serverTimestamp: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    const current = (snapshot.data() ?? {}) as Record<string, unknown>;
    transaction.set(
      ref,
      {
        uid: viewer.uid,
        email: viewer.email ?? (typeof current.email === 'string' ? current.email : null),
        displayName:
          viewer.name ?? (typeof current.displayName === 'string' ? current.displayName : null),
        photoURL:
          viewer.picture ?? (typeof current.photoURL === 'string' ? current.photoURL : null),
        lastLoginAt: nowIso,
        updatedAt: nowIso,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  return NextResponse.json({ ok: true });
}
