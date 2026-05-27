import 'server-only';

import { dateKeyFromIso, isoNow } from '@/lib/admin-log';
import { ANALYTICS_FEATURES, type AnalyticsFeature } from '@/lib/analytics-types';
import { getFirebaseAdminDb, isFirebaseAdminCredentialError, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { readAdminUsers } from '@/lib/admin-data';
import { readBugReportOverviewCounts } from '@/lib/bug-report-server';

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function maskEmail(email: string | null | undefined): string {
  if (!email) return '—';
  const [local, domain] = email.split('@');
  if (!domain) return '—';
  return `${local.slice(0, 1)}***@${domain}`;
}

const FEATURE_LABELS: Record<AnalyticsFeature, string> = {
  dashboard: 'Dashboard',
  calendar: 'Calendar',
  tasks: 'Tasks',
  focus: 'Focus Timer',
  cue_ai: 'Cue AI',
  notes: 'Notes',
  stats: 'Stats',
  settings: 'Settings',
  quiz_generator: 'Quiz Generator',
  flashcards: 'Flashcards',
  file_study: 'File Study',
  bug_reports: 'Bug Reports',
};

export type ProductAnalyticsDashboard = {
  summary: {
    totalUsers: number;
    signupsToday: number;
    activeUsersToday: number;
    activeUsersThisWeek: number;
    cueMessagesToday: number;
    notesUploadedToday: number;
    bugReportsOpen: number;
    bugReportsSubmittedToday: number;
    totalStorageUsedBytes: number;
  };
  retention: {
    cohortDateKey: string;
    cohortSize: number;
    d1Returned: number;
    d1Rate: number;
    d7Returned: number;
    d7Rate: number;
  };
  featureUsage: Array<{
    feature: AnalyticsFeature;
    label: string;
    eventsToday: number;
    eventsLast7Days: number;
    uniqueUsersLast7Days: number;
  }>;
  planBreakdownToday: {
    free: number;
    beta: number;
    premium: number;
  };
  recentEvents: Array<{
    id: string;
    createdAt: string;
    eventType: string;
    feature: string;
    userPlan: string;
    route: string | null;
    emailMasked: string;
    uid: string;
  }>;
  mostUsedFeatureLast7Days: string | null;
};

function readFeatureUsageFromDaily(data: Record<string, unknown> | undefined, feature: AnalyticsFeature) {
  const nested = data?.featureUsage;
  if (nested && typeof nested === 'object' && feature in (nested as Record<string, unknown>)) {
    return parseNumber((nested as Record<string, unknown>)[feature]);
  }
  return parseNumber(data?.[`featureUsage.${feature}`]);
}

/** Lightweight metrics for admin overview cards (avoids heavy retention scans). */
export async function readAnalyticsOverviewExtras() {
  const fallback = {
    activeUsersToday: 0,
    activeUsersThisWeek: 0,
    d1RetentionRate: 0,
    d7RetentionRate: 0,
    mostUsedFeature: null as string | null,
    signupsToday: 0,
  };

  if (!readFirebaseAdminStatus().configured) return fallback;

  try {
    const db = getFirebaseAdminDb();
    const todayKey = dateKeyFromIso(isoNow());
    const weekKeys = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(todayKey, -index));

    const [todayDaily, activeTodayCount, weekDailyDocs] = await Promise.all([
      db.doc(`analyticsDaily/${todayKey}`).get(),
      db.collection(`activeUsersDaily/${todayKey}/users`).count().get(),
      db.getAll(...weekKeys.map((key) => db.doc(`analyticsDaily/${key}`))),
    ]);

    const todayData = todayDaily.data() ?? {};
    let eventsLast7ByFeature: Array<{ feature: AnalyticsFeature; total: number }> = ANALYTICS_FEATURES.map(
      (feature) => ({ feature, total: 0 }),
    );

    for (const doc of weekDailyDocs) {
      const data = doc.data();
      eventsLast7ByFeature = eventsLast7ByFeature.map((row) => ({
        ...row,
        total: row.total + readFeatureUsageFromDaily(data, row.feature),
      }));
    }

    const topFeature = [...eventsLast7ByFeature].sort((a, b) => b.total - a.total)[0];
    const activeUsersThisWeek = weekDailyDocs.reduce(
      (sum, doc) => sum + parseNumber(doc.data()?.activeUsers),
      0,
    );

    const cohortDateKey = addDaysToDateKey(todayKey, -7);
    const cohortSnap = await db
      .collection('users')
      .where('createdAt', '>=', `${cohortDateKey}T00:00:00.000Z`)
      .where('createdAt', '<=', `${cohortDateKey}T23:59:59.999Z`)
      .limit(200)
      .get()
      .catch(() => null);

    let d1Returned = 0;
    let d7Returned = 0;
    const cohortSize = cohortSnap?.size ?? 0;
    const d1Key = addDaysToDateKey(cohortDateKey, 1);
    const d7Key = addDaysToDateKey(cohortDateKey, 7);

    if (cohortSnap && cohortSize > 0) {
      const checks = await Promise.all(
        cohortSnap.docs.map(async (doc) => {
          const [d1, d7] = await Promise.all([
            db.doc(`activeUsersDaily/${d1Key}/users/${doc.id}`).get(),
            db.doc(`activeUsersDaily/${d7Key}/users/${doc.id}`).get(),
          ]);
          return { d1: d1.exists, d7: d7.exists };
        }),
      );
      d1Returned = checks.filter((row) => row.d1).length;
      d7Returned = checks.filter((row) => row.d7).length;
    }

    return {
      activeUsersToday: activeTodayCount.data().count ?? parseNumber(todayData.activeUsers),
      activeUsersThisWeek: activeUsersThisWeek || (activeTodayCount.data().count ?? 0),
      signupsToday: parseNumber(todayData.signups),
      d1RetentionRate: cohortSize > 0 ? d1Returned / cohortSize : 0,
      d7RetentionRate: cohortSize > 0 ? d7Returned / cohortSize : 0,
      mostUsedFeature:
        topFeature && topFeature.total > 0 ? FEATURE_LABELS[topFeature.feature] : null,
    };
  } catch {
    return fallback;
  }
}

export async function readProductAnalyticsDashboard(): Promise<ProductAnalyticsDashboard> {
  const empty: ProductAnalyticsDashboard = {
    summary: {
      totalUsers: 0,
      signupsToday: 0,
      activeUsersToday: 0,
      activeUsersThisWeek: 0,
      cueMessagesToday: 0,
      notesUploadedToday: 0,
      bugReportsOpen: 0,
      bugReportsSubmittedToday: 0,
      totalStorageUsedBytes: 0,
    },
    retention: {
      cohortDateKey: addDaysToDateKey(dateKeyFromIso(isoNow()), -7),
      cohortSize: 0,
      d1Returned: 0,
      d1Rate: 0,
      d7Returned: 0,
      d7Rate: 0,
    },
    featureUsage: ANALYTICS_FEATURES.map((feature) => ({
      feature,
      label: FEATURE_LABELS[feature],
      eventsToday: 0,
      eventsLast7Days: 0,
      uniqueUsersLast7Days: 0,
    })),
    planBreakdownToday: { free: 0, beta: 0, premium: 0 },
    recentEvents: [],
    mostUsedFeatureLast7Days: null,
  };

  if (!readFirebaseAdminStatus().configured) return empty;

  try {
    const db = getFirebaseAdminDb();
    const todayKey = dateKeyFromIso(isoNow());
    const weekKeys = Array.from({ length: 7 }, (_, index) => addDaysToDateKey(todayKey, -index));

    const usersResult = await readAdminUsers();
    const totalStorageUsedBytes = usersResult.users.reduce(
      (sum, user) => sum + (user.storageUsedBytes ?? 0),
      0,
    );

    const [todayDaily, weekDailyDocs, bugCounts, recentEventsSnap, activeTodayCount] =
      await Promise.all([
        db.doc(`analyticsDaily/${todayKey}`).get(),
        db.getAll(...weekKeys.map((key) => db.doc(`analyticsDaily/${key}`))),
        readBugReportOverviewCounts().catch(() => ({ openReports: 0, reportsToday: 0 })),
        db.collection('analyticsEvents').orderBy('createdAt', 'desc').limit(40).get(),
        db.collection(`activeUsersDaily/${todayKey}/users`).count().get(),
      ]);

    const todayData = todayDaily.data() ?? {};
    const featureUsage = ANALYTICS_FEATURES.map((feature) => {
      const eventsToday = readFeatureUsageFromDaily(todayData, feature);
      let eventsLast7Days = 0;
      for (const doc of weekDailyDocs) {
        eventsLast7Days += readFeatureUsageFromDaily(doc.data(), feature);
      }
      return {
        feature,
        label: FEATURE_LABELS[feature],
        eventsToday,
        eventsLast7Days,
        uniqueUsersLast7Days: 0,
      };
    });

    await Promise.all(
      featureUsage.map(async (row, index) => {
        const unique = new Set<string>();
        await Promise.all(
          weekKeys.map(async (key) => {
            const snap = await db
              .collection(`analyticsFeatureDaily/${key}/features/${row.feature}/users`)
              .select()
              .limit(100)
              .get();
            for (const doc of snap.docs) unique.add(doc.id);
          }),
        );
        featureUsage[index]!.uniqueUsersLast7Days = unique.size;
      }),
    );

    const mostUsed = [...featureUsage].sort((a, b) => b.eventsLast7Days - a.eventsLast7Days)[0];

    const cohortDateKey = addDaysToDateKey(todayKey, -7);
    const cohortSnap = await db
      .collection('users')
      .where('createdAt', '>=', `${cohortDateKey}T00:00:00.000Z`)
      .where('createdAt', '<=', `${cohortDateKey}T23:59:59.999Z`)
      .limit(200)
      .get()
      .catch(() => null);

    let d1Returned = 0;
    let d7Returned = 0;
    const cohortSize = cohortSnap?.size ?? 0;
    const d1Key = addDaysToDateKey(cohortDateKey, 1);
    const d7Key = addDaysToDateKey(cohortDateKey, 7);

    if (cohortSnap) {
      const checks = await Promise.all(
        cohortSnap.docs.map(async (doc) => {
          const [d1, d7] = await Promise.all([
            db.doc(`activeUsersDaily/${d1Key}/users/${doc.id}`).get(),
            db.doc(`activeUsersDaily/${d7Key}/users/${doc.id}`).get(),
          ]);
          return { d1: d1.exists, d7: d7.exists };
        }),
      );
      d1Returned = checks.filter((row) => row.d1).length;
      d7Returned = checks.filter((row) => row.d7).length;
    }

    const emailByUid = new Map(usersResult.users.map((user) => [user.uid, user.email]));
    const recentEvents = (recentEventsSnap?.docs ?? []).map((doc) => {
      const data = doc.data();
      const uid = typeof data.uid === 'string' ? data.uid : 'unknown';
      return {
        id: doc.id,
        createdAt: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
        eventType: typeof data.eventType === 'string' ? data.eventType : 'unknown',
        feature: typeof data.feature === 'string' ? data.feature : 'unknown',
        userPlan: typeof data.userPlan === 'string' ? data.userPlan : 'free',
        route: typeof data.route === 'string' ? data.route : null,
        emailMasked: maskEmail(emailByUid.get(uid)),
        uid,
      };
    });

    const planBreakdown = todayData.planBreakdown ?? {};
    const activeUsersThisWeek = weekDailyDocs.reduce(
      (sum, doc) => sum + parseNumber(doc.data()?.activeUsers),
      0,
    );

    return {
      summary: {
        totalUsers: usersResult.mergedUsersCount,
        signupsToday: parseNumber(todayData.signups),
        activeUsersToday: activeTodayCount.data().count ?? parseNumber(todayData.activeUsers),
        activeUsersThisWeek: activeUsersThisWeek || (activeTodayCount.data().count ?? 0),
        cueMessagesToday: parseNumber(todayData.cueMessages),
        notesUploadedToday: parseNumber(todayData.notesUploaded),
        bugReportsOpen: bugCounts?.openReports ?? 0,
        bugReportsSubmittedToday:
          parseNumber(todayData.bugReportsSubmitted) || bugCounts?.reportsToday || 0,
        totalStorageUsedBytes,
      },
      retention: {
        cohortDateKey,
        cohortSize,
        d1Returned,
        d1Rate: cohortSize > 0 ? d1Returned / cohortSize : 0,
        d7Returned,
        d7Rate: cohortSize > 0 ? d7Returned / cohortSize : 0,
      },
      featureUsage,
      planBreakdownToday: {
        free: parseNumber(planBreakdown.free),
        beta: parseNumber(planBreakdown.beta),
        premium: parseNumber(planBreakdown.premium),
      },
      recentEvents,
      mostUsedFeatureLast7Days: mostUsed && mostUsed.eventsLast7Days > 0 ? mostUsed.label : null,
    };
  } catch (error) {
    if (isFirebaseAdminCredentialError(error)) return empty;
    throw error;
  }
}
