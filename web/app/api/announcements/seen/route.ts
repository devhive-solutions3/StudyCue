import { NextResponse } from 'next/server';

import { markAnnouncementSeen } from '@/lib/announcements-server';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: { announcementId?: string };
  try {
    body = (await request.json()) as { announcementId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const announcementId = typeof body.announcementId === 'string' ? body.announcementId.trim() : '';
  if (!announcementId) {
    return NextResponse.json({ error: 'announcementId is required.' }, { status: 400 });
  }

  await markAnnouncementSeen(viewer.uid, announcementId);
  return NextResponse.json({ ok: true });
}
