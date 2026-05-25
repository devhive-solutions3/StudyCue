import { NextResponse } from 'next/server';

import { assertAdminApiRequest } from '@/lib/admin-auth';
import { AdminConfigError } from '@/lib/firebase-admin';
import { updateAdminUserPlan } from '@/lib/admin-data';
import { normalizePlan } from '@/lib/user-plan';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;

  let body: { uid?: string; plan?: string };
  try {
    body = (await request.json()) as { uid?: string; plan?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  const plan = normalizePlan(body.plan);

  if (!uid) {
    return NextResponse.json({ error: 'Missing uid.' }, { status: 400 });
  }
  if (!['free', 'beta', 'premium'].includes(String(body.plan))) {
    return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 });
  }

  try {
    const result = await updateAdminUserPlan({
      actorUid: admin.uid,
      actorEmail: admin.email,
      uid,
      plan,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AdminConfigError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const message = error instanceof Error ? error.message : 'Could not update user plan.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
