import 'server-only';

import { FieldValue } from 'firebase-admin/firestore';

import { dateKeyFromIso, isoNow, monthKeyFromIso } from '@/lib/admin-log';
import type {
  AnalyticsEventType,
  AnalyticsFeature,
  AnalyticsUserPlan,
} from '@/lib/analytics-types';
import { sanitizeAnalyticsMetadata } from '@/lib/analytics-metadata';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { normalizePlan, type UserPlan } from '@/lib/user-plan';

const IS_DEV = process.env.NODE_ENV !== 'production';

export function weekKeyFromIso(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(0, 10);
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function planFromProfile(profile: Record<string, unknown> | null | undefined): AnalyticsUserPlan {
  if (!profile) return 'free';
  return normalizePlan(
    (typeof profile.plan === 'string' ? profile.plan : profile.accountType) as UserPlan | string,
  ) as AnalyticsUserPlan;
}

export type LogAnalyticsEventInput = {
  uid: string;
  userPlan: AnalyticsUserPlan;
  eventType: AnalyticsEventType;
  feature: AnalyticsFeature;
  route?: string | null;
  metadata?: Record<string, unknown>;
};

export async function logAnalyticsEvent(input: LogAnalyticsEventInput): Promise<boolean> {
  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) console.warn('[analytics] skipped: admin not configured');
    return false;
  }

  const createdAt = isoNow();
  const dateKey = dateKeyFromIso(createdAt);
  const weekKey = weekKeyFromIso(createdAt);
  const monthKey = monthKeyFromIso(createdAt);
  const metadata = sanitizeAnalyticsMetadata(input.metadata);
  const route =
    typeof input.route === 'string' && input.route.length <= 200 ? input.route : null;

  const db = getFirebaseAdminDb();
  const eventRef = db.collection('analyticsEvents').doc();

  await eventRef.set({
    eventId: eventRef.id,
    uid: input.uid,
    userPlan: input.userPlan,
    eventType: input.eventType,
    feature: input.feature,
    route,
    dateKey,
    weekKey,
    monthKey,
    createdAt,
    metadata,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  await incrementDailyCounters({
    dateKey,
    eventType: input.eventType,
    metadata,
  });

  return true;
}

async function incrementDailyCounters(params: {
  dateKey: string;
  eventType: AnalyticsEventType;
  metadata?: Record<string, string | number | boolean | null>;
}) {
  const db = getFirebaseAdminDb();
  const dailyRef = db.doc(`analyticsDaily/${params.dateKey}`);
  const payload: Record<string, unknown> = {
    dateKey: params.dateKey,
    updatedAt: isoNow(),
    serverTimestamp: FieldValue.serverTimestamp(),
  };

  switch (params.eventType) {
    case 'signup':
      payload.signups = FieldValue.increment(1);
      break;
    case 'cue_message':
      payload.cueMessages = FieldValue.increment(1);
      break;
    case 'note_upload':
      payload.notesUploaded = FieldValue.increment(1);
      break;
    case 'bug_report_submit':
      payload.bugReportsSubmitted = FieldValue.increment(1);
      break;
    case 'storage_update': {
      const bytes = params.metadata?.storageUsedBytes;
      if (typeof bytes === 'number' && Number.isFinite(bytes)) {
        payload.totalStorageUsedBytes = bytes;
      }
      break;
    }
    case 'study_tool_generation':
      payload.studyToolGenerations = FieldValue.increment(1);
      break;
    default:
      break;
  }

  if (Object.keys(payload).length > 3) {
    await dailyRef.set(payload, { merge: true });
  }
}

export type MarkUserActiveInput = {
  uid: string;
  userPlan: AnalyticsUserPlan;
  feature: AnalyticsFeature;
  route?: string | null;
  eventType?: AnalyticsEventType;
  metadata?: Record<string, unknown>;
  incrementPageView?: boolean;
  recordLogin?: boolean;
};

export async function markUserActive(input: MarkUserActiveInput): Promise<{
  isNewActiveToday: boolean;
  loggedLoginToday: boolean;
}> {
  if (!readFirebaseAdminStatus().configured) {
    return { isNewActiveToday: false, loggedLoginToday: false };
  }

  const now = isoNow();
  const dateKey = dateKeyFromIso(now);
  const db = getFirebaseAdminDb();
  const userDailyRef = db.doc(`users/${input.uid}/analytics/${dateKey}`);
  const activeRef = db.doc(`activeUsersDaily/${dateKey}/users/${input.uid}`);
  const featureUserRef = db.doc(
    `analyticsFeatureDaily/${dateKey}/features/${input.feature}/users/${input.uid}`,
  );

  let isNewActiveToday = false;
  let loggedLoginToday = false;

  await db.runTransaction(async (transaction) => {
    const [userDailySnap, activeSnap] = await Promise.all([
      transaction.get(userDailyRef),
      transaction.get(activeRef),
    ]);

    const existing = userDailySnap.exists
      ? (userDailySnap.data() as Record<string, unknown>)
      : {};
    isNewActiveToday = !activeSnap.exists;
    loggedLoginToday = Boolean(input.recordLogin) && !existing.loggedInToday;

    const userDailyUpdate: Record<string, unknown> = {
      dateKey,
      active: true,
      featuresUsed: FieldValue.arrayUnion(input.feature),
      loggedInToday: existing.loggedInToday || Boolean(input.recordLogin),
      firstSeenAt: typeof existing.firstSeenAt === 'string' ? existing.firstSeenAt : now,
      lastSeenAt: now,
      updatedAt: now,
      serverTimestamp: FieldValue.serverTimestamp(),
    };

    if (input.incrementPageView) userDailyUpdate.pageViews = FieldValue.increment(1);
    if (input.eventType === 'cue_message') userDailyUpdate.cueMessages = FieldValue.increment(1);
    if (input.eventType === 'note_upload') userDailyUpdate.notesUploaded = FieldValue.increment(1);
    if (input.eventType === 'bug_report_submit') {
      userDailyUpdate.bugReportsSubmitted = FieldValue.increment(1);
    }
    const storageBytes = sanitizeAnalyticsMetadata(input.metadata).storageUsedBytes;
    if (typeof storageBytes === 'number') userDailyUpdate.storageUsedBytes = storageBytes;

    transaction.set(activeRef, {
      uid: input.uid,
      userPlan: input.userPlan,
      firstSeenAt: activeSnap.exists ? (activeSnap.data()?.firstSeenAt ?? now) : now,
      lastSeenAt: now,
      serverTimestamp: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(featureUserRef, {
      uid: input.uid,
      userPlan: input.userPlan,
      feature: input.feature,
      lastSeenAt: now,
      serverTimestamp: FieldValue.serverTimestamp(),
    }, { merge: true });

    transaction.set(userDailyRef, userDailyUpdate, { merge: true });

    const dailyPayload: Record<string, unknown> = {
      dateKey,
      updatedAt: now,
      [`featureUsage.${input.feature}`]: FieldValue.increment(1),
    };

    if (isNewActiveToday) {
      dailyPayload[`planBreakdown.${input.userPlan}`] = FieldValue.increment(1);
    }
    if (loggedLoginToday) dailyPayload.logins = FieldValue.increment(1);

    transaction.set(db.doc(`analyticsDaily/${dateKey}`), dailyPayload, { merge: true });
  });

  if (isNewActiveToday) {
    const activeCount = await db.collection(`activeUsersDaily/${dateKey}/users`).count().get().catch(() => null);
    if (activeCount) {
      await db.doc(`analyticsDaily/${dateKey}`).set(
        { activeUsers: activeCount.data().count ?? 0, updatedAt: isoNow() },
        { merge: true },
      );
    }
  }

  return { isNewActiveToday, loggedLoginToday };
}

export async function trackServerAnalyticsEvent(
  input: LogAnalyticsEventInput & {
    markActive?: boolean;
    incrementPageView?: boolean;
    recordLogin?: boolean;
  },
) {
  await logAnalyticsEvent(input);
  if (input.markActive === false) return;

  await markUserActive({
    uid: input.uid,
    userPlan: input.userPlan,
    feature: input.feature,
    route: input.route,
    eventType: input.eventType,
    metadata: input.metadata,
    incrementPageView:
      input.incrementPageView ??
      (input.eventType === 'page_view' || input.eventType === 'feature_open'),
    recordLogin: input.recordLogin ?? input.eventType === 'login',
  });
}

export async function recordAiRequestAnalytics(params: {
  uid: string;
  userPlan: AnalyticsUserPlan;
  provider: string;
  model: string;
  status: string;
  endpoint: string;
  feature: AnalyticsFeature;
  inputTokensEstimate?: number;
  outputTokensEstimate?: number;
  totalTokensEstimate?: number;
}) {
  const route =
    params.feature === 'quiz_generator'
      ? '/app/quiz'
      : params.feature === 'flashcards'
        ? '/app/flashcards'
        : params.feature === 'file_study'
          ? '/app/file-study'
          : '/app/chat';

  await trackServerAnalyticsEvent({
    uid: params.uid,
    userPlan: params.userPlan,
    eventType: 'cue_message',
    feature: params.feature,
    route,
    metadata: {
      provider: params.provider,
      model: params.model,
      status: params.status,
      endpoint: params.endpoint,
      inputTokensEstimate: params.inputTokensEstimate ?? 0,
      outputTokensEstimate: params.outputTokensEstimate ?? 0,
      totalTokensEstimate: params.totalTokensEstimate ?? 0,
    },
    markActive: true,
    incrementPageView: false,
  });
}

/** @deprecated Use recordAiRequestAnalytics */
export const recordCueMessageAnalytics = (params: {
  uid: string;
  userPlan: AnalyticsUserPlan;
  provider: string;
  model: string;
  status: string;
  endpoint: string;
  inputTokensEstimate?: number;
  outputTokensEstimate?: number;
  totalTokensEstimate?: number;
}) =>
  recordAiRequestAnalytics({
    ...params,
    feature: 'cue_ai',
  });

export async function refreshDailyStorageSnapshot() {
  if (!readFirebaseAdminStatus().configured) return;
  const totalStorageUsedBytes = await sumUserStorageUsedBytes();
  const dateKey = dateKeyFromIso(isoNow());
  await getFirebaseAdminDb().doc(`analyticsDaily/${dateKey}`).set(
    {
      totalStorageUsedBytes,
      updatedAt: isoNow(),
    },
    { merge: true },
  );
}

async function sumUserStorageUsedBytes() {
  const db = getFirebaseAdminDb();
  let totalStorageUsedBytes = 0;
  let lastId: string | undefined;

  for (;;) {
    let query = db.collection('users').select('storageUsedBytes').orderBy('__name__').limit(500);
    if (lastId) query = query.startAfter(lastId);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    for (const doc of snapshot.docs) {
      const value = doc.data().storageUsedBytes;
      if (typeof value === 'number' && Number.isFinite(value)) totalStorageUsedBytes += value;
      lastId = doc.id;
    }
    if (snapshot.size < 500) break;
  }

  return totalStorageUsedBytes;
}
