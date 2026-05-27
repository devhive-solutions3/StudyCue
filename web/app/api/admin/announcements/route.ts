import { NextResponse } from 'next/server';

import { assertAdminApiRequest } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-log';
import {
  listAnnouncementsAdmin,
  upsertAnnouncementAdmin,
} from '@/lib/announcements-server';
import type { AnnouncementTargetPlan, AnnouncementType } from '@/lib/announcements-types';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;
  const announcements = await listAnnouncementsAdmin();
  return NextResponse.json({ ok: true, announcements });
}

export async function POST(request: Request) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!title || !message) {
    return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });
  }

  const type = (typeof body.type === 'string' ? body.type : 'general') as AnnouncementType;
  const targetPlans = Array.isArray(body.targetPlans)
    ? (body.targetPlans.filter((p) => typeof p === 'string') as AnnouncementTargetPlan[])
    : (['all'] as AnnouncementTargetPlan[]);

  const record = await upsertAnnouncementAdmin({
    title,
    message,
    type,
    targetPlans,
    ctaLabel: typeof body.ctaLabel === 'string' ? body.ctaLabel : null,
    ctaHref: typeof body.ctaHref === 'string' ? body.ctaHref : null,
    publishNow: body.publishNow === true,
    expiresAt: typeof body.expiresAt === 'string' ? body.expiresAt : null,
    actorUid: admin.uid,
    actorEmail: admin.email ?? null,
  });

  await writeAdminAuditLog({
    actorUid: admin.uid,
    actorEmail: admin.email ?? null,
    action: body.publishNow ? 'announcement_publish' : 'announcement_create',
    targetType: 'announcement',
    targetId: record.announcementId,
  });

  return NextResponse.json({ ok: true, announcement: record });
}
