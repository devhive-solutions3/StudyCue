import { NextResponse } from 'next/server';

import { assertAdminApiRequest } from '@/lib/admin-auth';
import { writeAdminAuditLog } from '@/lib/admin-log';
import {
  getAnnouncementAdmin,
  setAnnouncementStatusAdmin,
  upsertAnnouncementAdmin,
} from '@/lib/announcements-server';
import type { AnnouncementStatus, AnnouncementTargetPlan, AnnouncementType } from '@/lib/announcements-types';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ announcementId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;
  const { announcementId } = await context.params;
  const announcement = await getAnnouncementAdmin(announcementId);
  if (!announcement) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, announcement });
}

export async function PATCH(request: Request, context: RouteContext) {
  const admin = await assertAdminApiRequest(request);
  if (admin instanceof NextResponse) return admin;
  const { announcementId } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  if (typeof body.status === 'string') {
    const status = body.status as AnnouncementStatus;
    const record = await setAnnouncementStatusAdmin({
      announcementId,
      status,
      actorUid: admin.uid,
      actorEmail: admin.email ?? null,
    });
    if (!record) return NextResponse.json({ error: 'Not found.' }, { status: 404 });

    const action =
      status === 'published'
        ? 'announcement_publish'
        : status === 'draft'
          ? 'announcement_unpublish'
          : 'announcement_archive';

    await writeAdminAuditLog({
      actorUid: admin.uid,
      actorEmail: admin.email ?? null,
      action,
      targetType: 'announcement',
      targetId: announcementId,
    });

    return NextResponse.json({ ok: true, announcement: record });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!title || !message) {
    return NextResponse.json({ error: 'Title and message are required.' }, { status: 400 });
  }

  const record = await upsertAnnouncementAdmin({
    announcementId,
    title,
    message,
    type: (typeof body.type === 'string' ? body.type : 'general') as AnnouncementType,
    targetPlans: Array.isArray(body.targetPlans)
      ? (body.targetPlans.filter((p) => typeof p === 'string') as AnnouncementTargetPlan[])
      : (['all'] as AnnouncementTargetPlan[]),
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
    action: body.publishNow ? 'announcement_publish' : 'announcement_update',
    targetType: 'announcement',
    targetId: record.announcementId,
  });

  return NextResponse.json({ ok: true, announcement: record });
}
