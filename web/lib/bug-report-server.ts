import 'server-only';

import { randomUUID } from 'crypto';

import { FieldValue } from 'firebase-admin/firestore';

import {
  type AdminUpdateBugReportInput,
  type AttachBugReportScreenshotInput,
  type BugReportFollowUp,
  type BugReportListRow,
  type BugReportOverviewCounts,
  type BugReportPriority,
  type BugReportRecord,
  type BugReportStatus,
  type CreateBugReportInput,
  type UserBugReportView,
  BUG_REPORT_PRIORITIES,
  BUG_REPORT_STATUSES,
  canUserFollowUp,
  isBugReportSolved,
} from '@/lib/bug-report-types';
import { isoNow, writeAdminAuditLog } from '@/lib/admin-log';
import { getFirebaseAdminDb, getFirebaseAdminStorage } from '@/lib/firebase-admin';
import { getUserPlanByUid, getUserProfileByUid } from '@/lib/server-user-plan';
import { getUserPlan } from '@/lib/plan-access';
import type { UserPlan } from '@/lib/user-plan';

const REPORT_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomReportSuffix(length = 4): string {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += REPORT_ID_ALPHABET[Math.floor(Math.random() * REPORT_ID_ALPHABET.length)];
  }
  return value;
}

export function generateBugReportId(now = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `BR-${year}${month}${day}-${randomReportSuffix()}`;
}

function normalizeStatus(value: unknown): BugReportStatus | null {
  if (typeof value !== 'string') return null;
  return BUG_REPORT_STATUSES.includes(value as BugReportStatus) ? (value as BugReportStatus) : null;
}

function normalizePriority(value: unknown): BugReportPriority | null {
  if (typeof value !== 'string') return null;
  return BUG_REPORT_PRIORITIES.includes(value as BugReportPriority)
    ? (value as BugReportPriority)
    : null;
}

function parseFollowUps(value: unknown): BugReportFollowUp[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const message = typeof row.message === 'string' ? row.message.trim() : '';
      if (!message) return null;
      return {
        id: typeof row.id === 'string' ? row.id : `fu-${Date.now()}`,
        message,
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : isoNow(),
      };
    })
    .filter((entry): entry is BugReportFollowUp => entry !== null);
}

function toUserBugReportView(report: BugReportRecord): UserBugReportView {
  const solved = isBugReportSolved(report.status);
  return {
    reportId: report.reportId,
    title: report.title,
    description: report.description,
    pageUrl: report.pageUrl,
    screenshotUrl: report.screenshotUrl,
    status: report.status,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
    followUps: report.followUps,
    resolution: solved && report.adminNotes ? report.adminNotes : null,
    isSolved: solved,
  };
}

function parseRecord(reportId: string, data: Record<string, unknown>): BugReportRecord {
  return {
    reportId,
    uid: typeof data.uid === 'string' ? data.uid : '',
    userEmail: typeof data.userEmail === 'string' ? data.userEmail : null,
    userDisplayName: typeof data.userDisplayName === 'string' ? data.userDisplayName : null,
    userPlan: (['free', 'beta', 'premium'].includes(String(data.userPlan))
      ? data.userPlan
      : 'free') as UserPlan,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    pageUrl: typeof data.pageUrl === 'string' ? data.pageUrl : null,
    browserInfo: typeof data.browserInfo === 'string' ? data.browserInfo : null,
    deviceInfo: typeof data.deviceInfo === 'string' ? data.deviceInfo : null,
    screenshotUrl: typeof data.screenshotUrl === 'string' ? data.screenshotUrl : null,
    screenshotStoragePath:
      typeof data.screenshotStoragePath === 'string' ? data.screenshotStoragePath : null,
    screenshotOriginalName:
      typeof data.screenshotOriginalName === 'string' ? data.screenshotOriginalName : null,
    screenshotSizeBytes:
      typeof data.screenshotSizeBytes === 'number' && Number.isFinite(data.screenshotSizeBytes)
        ? data.screenshotSizeBytes
        : null,
    status: normalizeStatus(data.status) ?? 'open',
    priority: normalizePriority(data.priority) ?? 'unset',
    adminNotes: typeof data.adminNotes === 'string' ? data.adminNotes : null,
    followUps: parseFollowUps(data.followUps),
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : isoNow(),
    resolvedAt: typeof data.resolvedAt === 'string' ? data.resolvedAt : null,
    resolvedByUid: typeof data.resolvedByUid === 'string' ? data.resolvedByUid : null,
    resolvedByEmail: typeof data.resolvedByEmail === 'string' ? data.resolvedByEmail : null,
  };
}

function toListRow(report: BugReportRecord): BugReportListRow {
  return {
    reportId: report.reportId,
    uid: report.uid,
    userEmail: report.userEmail,
    userDisplayName: report.userDisplayName,
    userPlan: report.userPlan,
    title: report.title,
    pageUrl: report.pageUrl,
    status: report.status,
    priority: report.priority,
    createdAt: report.createdAt,
    screenshotUrl: report.screenshotUrl,
  };
}

export async function createBugReport(params: {
  uid: string;
  email: string | null;
  displayName: string | null;
  input: CreateBugReportInput;
}): Promise<BugReportRecord> {
  const db = getFirebaseAdminDb();
  const profile = await getUserProfileByUid(params.uid);
  const userPlan = profile ? getUserPlan(profile) : await getUserPlanByUid(params.uid);
  const now = isoNow();

  let reportId = generateBugReportId();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await db.doc(`bugReports/${reportId}`).get();
    if (!existing.exists) break;
    reportId = generateBugReportId();
  }

  const record: BugReportRecord = {
    reportId,
    uid: params.uid,
    userEmail: params.email,
    userDisplayName: params.displayName,
    userPlan,
    title: params.input.title.trim(),
    description: params.input.description.trim(),
    pageUrl: params.input.pageUrl?.trim() || null,
    browserInfo: params.input.browserInfo?.trim() || null,
    deviceInfo: params.input.deviceInfo?.trim() || null,
    screenshotUrl: null,
    screenshotStoragePath: null,
    screenshotOriginalName: null,
    screenshotSizeBytes: null,
    status: 'open',
    priority: 'unset',
    adminNotes: null,
    followUps: [],
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
    resolvedByUid: null,
    resolvedByEmail: null,
  };

  await db.doc(`bugReports/${reportId}`).set({
    ...record,
    followUps: [],
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return record;
}

function buildFirebaseStorageDownloadUrl(
  bucketName: string,
  storagePath: string,
  token: string,
): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media&token=${token}`;
}

export async function uploadBugReportScreenshotServer(params: {
  uid: string;
  reportId: string;
  buffer: Buffer;
  contentType: string;
  originalName: string;
}): Promise<AttachBugReportScreenshotInput> {
  if (params.buffer.length > 5 * 1024 * 1024) {
    throw new Error('Screenshot exceeds the 5 MB limit.');
  }

  const extension = params.contentType.includes('png')
    ? 'png'
    : params.contentType.includes('webp')
      ? 'webp'
      : 'jpg';
  const fileName = `screenshot-${Date.now()}.${extension}`;
  const storagePath = `bugReports/${params.uid}/${params.reportId}/${fileName}`;

  const bucket = getFirebaseAdminStorage().bucket();
  const file = bucket.file(storagePath);
  const token = randomUUID();

  await file.save(params.buffer, {
    resumable: false,
    metadata: {
      contentType: params.contentType,
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  });

  return {
    screenshotUrl: buildFirebaseStorageDownloadUrl(bucket.name, storagePath, token),
    screenshotStoragePath: storagePath,
    screenshotOriginalName: params.originalName,
    screenshotSizeBytes: params.buffer.length,
  };
}

export async function attachBugReportScreenshot(params: {
  reportId: string;
  uid: string;
  screenshot: AttachBugReportScreenshotInput;
}): Promise<BugReportRecord> {
  const db = getFirebaseAdminDb();
  const ref = db.doc(`bugReports/${params.reportId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Bug report not found.');
  }

  const existing = parseRecord(params.reportId, snapshot.data() as Record<string, unknown>);
  if (existing.uid !== params.uid) {
    throw new Error('Not allowed to update this bug report.');
  }

  const expectedPrefix = `bugReports/${params.uid}/${params.reportId}/`;
  if (!params.screenshot.screenshotStoragePath.startsWith(expectedPrefix)) {
    throw new Error('Invalid screenshot storage path.');
  }

  const updatedAt = isoNow();
  await ref.set(
    {
      screenshotUrl: params.screenshot.screenshotUrl,
      screenshotStoragePath: params.screenshot.screenshotStoragePath,
      screenshotOriginalName: params.screenshot.screenshotOriginalName,
      screenshotSizeBytes: params.screenshot.screenshotSizeBytes,
      updatedAt,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return {
    ...existing,
    ...params.screenshot,
    updatedAt,
  };
}

export async function readBugReportById(reportId: string): Promise<BugReportRecord | null> {
  const db = getFirebaseAdminDb();
  const snapshot = await db.doc(`bugReports/${reportId}`).get();
  if (!snapshot.exists) return null;
  return parseRecord(reportId, snapshot.data() as Record<string, unknown>);
}

export async function listBugReportsForUser(uid: string): Promise<UserBugReportView[]> {
  const db = getFirebaseAdminDb();
  const snapshot = await db.collection('bugReports').where('uid', '==', uid).limit(100).get();
  return snapshot.docs
    .map((doc) => toUserBugReportView(parseRecord(doc.id, doc.data() as Record<string, unknown>)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function addBugReportFollowUp(params: {
  reportId: string;
  uid: string;
  message: string;
}): Promise<UserBugReportView> {
  const db = getFirebaseAdminDb();
  const ref = db.doc(`bugReports/${params.reportId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Bug report not found.');
  }

  const existing = parseRecord(params.reportId, snapshot.data() as Record<string, unknown>);
  if (existing.uid !== params.uid) {
    throw new Error('Not allowed to update this bug report.');
  }
  if (!canUserFollowUp(existing.status)) {
    throw new Error('Follow-ups are only available for open or in-review reports.');
  }

  const trimmed = params.message.trim();
  if (!trimmed) {
    throw new Error('Follow-up message is required.');
  }
  if (trimmed.length > 2000) {
    throw new Error('Follow-up must be 2000 characters or fewer.');
  }
  if (existing.followUps.length >= 20) {
    throw new Error('Maximum follow-ups reached for this report.');
  }

  const followUp: BugReportFollowUp = {
    id: `fu-${Date.now()}-${randomReportSuffix(3)}`,
    message: trimmed,
    createdAt: isoNow(),
  };
  const updatedAt = isoNow();

  await ref.set(
    {
      followUps: [...existing.followUps, followUp],
      updatedAt,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return toUserBugReportView({
    ...existing,
    followUps: [...existing.followUps, followUp],
    updatedAt,
  });
}

export async function listBugReportsForAdmin(): Promise<BugReportListRow[]> {
  const db = getFirebaseAdminDb();
  const snapshot = await db.collection('bugReports').orderBy('createdAt', 'desc').limit(500).get();
  return snapshot.docs.map((doc) => toListRow(parseRecord(doc.id, doc.data() as Record<string, unknown>)));
}

export async function readBugReportOverviewCounts(): Promise<BugReportOverviewCounts> {
  const db = getFirebaseAdminDb();
  const today = isoNow().slice(0, 10);
  const snapshot = await db.collection('bugReports').limit(1000).get();

  const counts: BugReportOverviewCounts = {
    open: 0,
    reviewing: 0,
    fixed: 0,
    closed: 0,
    highPriority: 0,
    openReports: 0,
    reportsToday: 0,
  };

  for (const doc of snapshot.docs) {
    const report = parseRecord(doc.id, doc.data() as Record<string, unknown>);
    if (report.status === 'open') counts.open += 1;
    if (report.status === 'reviewing') counts.reviewing += 1;
    if (report.status === 'fixed') counts.fixed += 1;
    if (report.status === 'closed') counts.closed += 1;
    if (report.priority === 'high' || report.priority === 'critical') counts.highPriority += 1;
    if (report.createdAt.startsWith(today)) counts.reportsToday += 1;
  }

  counts.openReports = counts.open + counts.reviewing;
  return counts;
}

export async function updateBugReportAsAdmin(params: {
  reportId: string;
  actorUid: string;
  actorEmail: string | null;
  input: AdminUpdateBugReportInput;
}): Promise<BugReportRecord> {
  const db = getFirebaseAdminDb();
  const ref = db.doc(`bugReports/${params.reportId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new Error('Bug report not found.');
  }

  const existing = parseRecord(params.reportId, snapshot.data() as Record<string, unknown>);
  const nextStatus = params.input.status ?? existing.status;
  const nextPriority = params.input.priority ?? existing.priority;
  const nextAdminNotes =
    params.input.adminNotes === undefined ? existing.adminNotes : params.input.adminNotes;

  if (params.input.status && !normalizeStatus(params.input.status)) {
    throw new Error('Invalid status.');
  }
  if (params.input.priority && !normalizePriority(params.input.priority)) {
    throw new Error('Invalid priority.');
  }

  const updatedAt = isoNow();
  const resolvedStatuses: BugReportStatus[] = ['fixed', 'closed'];
  const shouldResolve =
    resolvedStatuses.includes(nextStatus) && !resolvedStatuses.includes(existing.status);

  const patch: Record<string, unknown> = {
    status: nextStatus,
    priority: nextPriority,
    adminNotes: nextAdminNotes,
    updatedAt,
    serverTimestamp: FieldValue.serverTimestamp(),
  };

  if (shouldResolve || (resolvedStatuses.includes(nextStatus) && !existing.resolvedAt)) {
    patch.resolvedAt = existing.resolvedAt ?? updatedAt;
    patch.resolvedByUid = existing.resolvedByUid ?? params.actorUid;
    patch.resolvedByEmail = existing.resolvedByEmail ?? params.actorEmail;
  }

  await ref.set(patch, { merge: true });

  await writeAdminAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: 'bug_report_update',
    targetType: 'bugReport',
    targetId: params.reportId,
    metadata: {
      previousStatus: existing.status,
      newStatus: nextStatus,
      previousPriority: existing.priority,
      newPriority: nextPriority,
    },
    severity: 'info',
  });

  return {
    ...existing,
    status: nextStatus,
    priority: nextPriority,
    adminNotes: nextAdminNotes,
    updatedAt,
    resolvedAt:
      typeof patch.resolvedAt === 'string'
        ? patch.resolvedAt
        : existing.resolvedAt,
    resolvedByUid:
      typeof patch.resolvedByUid === 'string'
        ? patch.resolvedByUid
        : existing.resolvedByUid,
    resolvedByEmail:
      typeof patch.resolvedByEmail === 'string'
        ? patch.resolvedByEmail
        : existing.resolvedByEmail,
  };
}
