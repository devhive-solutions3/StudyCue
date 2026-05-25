import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';

import { assertAdminApiRequest } from '@/lib/admin-auth';
import { getBetaSignupsMode } from '@/lib/beta-config-server';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { writeAdminAuditLog } from '@/lib/admin-log';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;

  const mode = await getBetaSignupsMode();
  return NextResponse.json({ ok: true, betaSignupsEnabled: mode.enabled, source: mode.source });
}

export async function POST(request: Request) {
  return updateBetaSignupMode(request);
}

export async function PATCH(request: Request) {
  return updateBetaSignupMode(request);
}

async function updateBetaSignupMode(request: Request) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;
  if (!readFirebaseAdminStatus().configured) {
    return NextResponse.json({ error: 'Admin data source not configured.' }, { status: 500 });
  }

  let body: { enabled?: boolean };
  try {
    body = (await request.json()) as { enabled?: boolean };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'Missing enabled boolean.' }, { status: 400 });
  }

  const db = getFirebaseAdminDb();
  const ref = db.doc('adminSettings/appConfig');
  const previousMode = await getBetaSignupsMode();

  await ref.set(
    {
      betaSignupsEnabled: body.enabled,
      updatedAt: new Date().toISOString(),
      updatedByUid: admin.uid,
      updatedByEmail: admin.email ?? null,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await writeAdminAuditLog({
    actorUid: admin.uid,
    actorEmail: admin.email,
    action: 'beta_signup_mode_update',
    targetType: 'adminSettings',
    targetId: 'appConfig',
    severity: 'info',
    metadata: {
      previousValue: previousMode.enabled,
      newValue: body.enabled,
    },
  });

  return NextResponse.json({ ok: true, betaSignupsEnabled: body.enabled });
}
