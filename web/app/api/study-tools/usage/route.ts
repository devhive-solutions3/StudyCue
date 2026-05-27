import { NextResponse } from 'next/server';

import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { getStudyToolsUsageForUser } from '@/lib/study-tools-server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const usage = await getStudyToolsUsageForUser(viewer.uid);
  return NextResponse.json({ ok: true, usage });
}
