import { NextResponse } from 'next/server';

import { getUnseenAnnouncementForUser } from '@/lib/announcements-server';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const announcement = await getUnseenAnnouncementForUser(viewer.uid);
  return NextResponse.json({ ok: true, announcement });
}
