import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { isoNow } from '@/lib/admin-log';
import type {
  AnnouncementPriority,
  AnnouncementPublic,
  AnnouncementRecord,
  AnnouncementStatus,
  AnnouncementTargetPlan,
  AnnouncementType,
} from '@/lib/announcements-types';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { getUserPlanByUid } from '@/lib/server-user-plan';
import type { UserPlan } from '@/lib/user-plan';

function parseAnnouncement(id: string, data: Record<string, unknown>): AnnouncementRecord {
  return {
    announcementId: id,
    title: typeof data.title === 'string' ? data.title : '',
    message: typeof data.message === 'string' ? data.message : '',
    type: (data.type as AnnouncementType) ?? 'general',
    status: (data.status as AnnouncementStatus) ?? 'draft',
    isActive: data.isActive !== false,
    targetPlans: Array.isArray(data.targetPlans)
      ? (data.targetPlans.filter((p) => typeof p === 'string') as AnnouncementTargetPlan[])
      : ['all'],
    targetRoutes: Array.isArray(data.targetRoutes)
      ? data.targetRoutes.filter((r): r is string => typeof r === 'string')
      : null,
    ctaLabel: typeof data.ctaLabel === 'string' ? data.ctaLabel : null,
    ctaHref: typeof data.ctaHref === 'string' ? data.ctaHref : null,
    priority: data.priority === 'high' ? 'high' : 'normal',
    publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : null,
    expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : null,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : isoNow(),
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
    createdByEmail: typeof data.createdByEmail === 'string' ? data.createdByEmail : null,
  };
}

function matchesPlan(targetPlans: AnnouncementTargetPlan[], plan: UserPlan) {
  if (targetPlans.includes('all')) return true;
  return targetPlans.includes(plan);
}

function isPublishedActive(record: AnnouncementRecord, nowIso: string) {
  if (record.status !== 'published' || !record.isActive) return false;
  if (!record.publishedAt || record.publishedAt > nowIso) return false;
  if (record.expiresAt && record.expiresAt <= nowIso) return false;
  return true;
}

export async function listAnnouncementsAdmin(): Promise<AnnouncementRecord[]> {
  if (!readFirebaseAdminStatus().configured) return [];
  const snapshot = await getFirebaseAdminDb()
    .collection('announcements')
    .orderBy('updatedAt', 'desc')
    .limit(200)
    .get()
    .catch(async () => {
      const fallback = await getFirebaseAdminDb().collection('announcements').limit(200).get();
      return fallback;
    });

  return snapshot.docs.map((doc) => parseAnnouncement(doc.id, (doc.data() ?? {}) as Record<string, unknown>));
}

export async function getAnnouncementAdmin(id: string): Promise<AnnouncementRecord | null> {
  if (!readFirebaseAdminStatus().configured) return null;
  const snapshot = await getFirebaseAdminDb().doc(`announcements/${id}`).get();
  if (!snapshot.exists) return null;
  return parseAnnouncement(snapshot.id, (snapshot.data() ?? {}) as Record<string, unknown>);
}

export async function upsertAnnouncementAdmin(params: {
  announcementId?: string;
  title: string;
  message: string;
  type: AnnouncementType;
  targetPlans: AnnouncementTargetPlan[];
  ctaLabel?: string | null;
  ctaHref?: string | null;
  priority?: AnnouncementPriority;
  publishNow?: boolean;
  expiresAt?: string | null;
  actorUid: string;
  actorEmail: string | null;
}): Promise<AnnouncementRecord> {
  const db = getFirebaseAdminDb();
  const ref = params.announcementId
    ? db.doc(`announcements/${params.announcementId}`)
    : db.collection('announcements').doc();
  const existing = params.announcementId ? await ref.get() : null;
  const now = isoNow();
  const existingData = (existing?.data() ?? {}) as Record<string, unknown>;
  const status = (existingData.status as AnnouncementStatus) ?? 'draft';
  const shouldPublish = Boolean(params.publishNow);
  const nextStatus: AnnouncementStatus = shouldPublish
    ? 'published'
    : status === 'archived'
      ? 'draft'
      : status;

  const payload = {
    announcementId: ref.id,
    title: params.title.trim(),
    message: params.message.trim(),
    type: params.type,
    targetPlans: params.targetPlans.length ? params.targetPlans : (['all'] as AnnouncementTargetPlan[]),
    ctaLabel: params.ctaLabel?.trim() || null,
    ctaHref: params.ctaHref?.trim() || null,
    priority: params.priority === 'high' ? 'high' : 'normal',
    expiresAt: params.expiresAt ?? null,
    status: nextStatus,
    isActive: nextStatus === 'published',
    publishedAt: shouldPublish ? now : (existingData.publishedAt as string | null) ?? null,
    updatedAt: now,
    createdAt: (existingData.createdAt as string) ?? now,
    createdByUid: (existingData.createdByUid as string) ?? params.actorUid,
    createdByEmail: (existingData.createdByEmail as string | null) ?? params.actorEmail,
    serverTimestamp: FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });
  return parseAnnouncement(ref.id, payload as unknown as Record<string, unknown>);
}

export async function setAnnouncementStatusAdmin(params: {
  announcementId: string;
  status: AnnouncementStatus;
  actorUid: string;
  actorEmail: string | null;
}): Promise<AnnouncementRecord | null> {
  const ref = getFirebaseAdminDb().doc(`announcements/${params.announcementId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return null;
  const now = isoNow();
  const isPublished = params.status === 'published';
  await ref.set(
    {
      status: params.status,
      isActive: isPublished,
      publishedAt: isPublished ? now : snapshot.data()?.publishedAt ?? null,
      updatedAt: now,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  const updated = await ref.get();
  return parseAnnouncement(updated.id, (updated.data() ?? {}) as Record<string, unknown>);
}

export async function getUnseenAnnouncementForUser(uid: string): Promise<AnnouncementPublic | null> {
  if (!readFirebaseAdminStatus().configured) return null;
  const plan = await getUserPlanByUid(uid);
  const now = isoNow();
  const db = getFirebaseAdminDb();

  const snapshot = await db
    .collection('announcements')
    .where('status', '==', 'published')
    .where('isActive', '==', true)
    .limit(50)
    .get()
    .catch(() => null);

  if (!snapshot) return null;

  const candidates = snapshot.docs
    .map((doc) => parseAnnouncement(doc.id, (doc.data() ?? {}) as Record<string, unknown>))
    .filter((record) => isPublishedActive(record, now) && matchesPlan(record.targetPlans, plan))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
      return String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? ''));
    });

  for (const record of candidates) {
    const seen = await db.doc(`users/${uid}/seenAnnouncements/${record.announcementId}`).get();
    if (!seen.exists) {
      return {
        announcementId: record.announcementId,
        title: record.title,
        message: record.message,
        type: record.type,
        ctaLabel: record.ctaLabel,
        ctaHref: record.ctaHref,
        priority: record.priority,
        publishedAt: record.publishedAt,
        expiresAt: record.expiresAt,
      };
    }
  }

  return null;
}

export async function markAnnouncementSeen(uid: string, announcementId: string) {
  const now = isoNow();
  await getFirebaseAdminDb()
    .doc(`users/${uid}/seenAnnouncements/${announcementId}`)
    .set(
      {
        announcementId,
        seenAt: now,
        dismissedAt: now,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export async function countActivePublishedAnnouncements(): Promise<number> {
  if (!readFirebaseAdminStatus().configured) return 0;
  const now = isoNow();
  const snapshot = await getFirebaseAdminDb()
    .collection('announcements')
    .where('status', '==', 'published')
    .where('isActive', '==', true)
    .get();
  return snapshot.docs.filter((doc) =>
    isPublishedActive(parseAnnouncement(doc.id, (doc.data() ?? {}) as Record<string, unknown>), now),
  ).length;
}
