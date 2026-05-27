import { NextResponse } from 'next/server';

import { listCueStudySessionsForUser } from '@/lib/cue-study-sessions-server';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const sessions = await listCueStudySessionsForUser(viewer.uid);
  return NextResponse.json({ ok: true, sessions });
}
