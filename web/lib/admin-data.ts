import 'server-only';

import { revalidatePath } from 'next/cache';
import { FieldPath, FieldValue } from 'firebase-admin/firestore';

import {
  AdminConfigError,
  getFirebaseAdminAuth,
  getFirebaseAdminDb,
  isFirebaseAdminCredentialError,
  readFirebaseAdminStatus,
} from '@/lib/firebase-admin';
import {
  type AdminDataSourceStatus,
  type AdminOverviewStats,
  type AdminSection,
  type AdminUserRow,
  type AdminUsersResult,
  type AdminUsageLogRow,
  type AiUsageDashboard,
  type RevenueDashboard,
  type RevenueMetric,
  type SecurityEventRow,
} from '@/lib/admin-shared';
import {
  dateKeyFromIso,
  isoNow,
  monthKeyFromIso,
  writeAdminAuditLog,
} from '@/lib/admin-log';
import { logCueUsage, estimateTokensFromCuePayload, estimateTokensFromText, estimateUsdCost } from '@/lib/ai-usage-logger';
import { requireAdminUser } from '@/lib/admin-auth';
import {
  getAdminBlogPostById,
  getAdminBlogPosts,
  isBlogSlugTaken,
  type ManagedBlogPost,
} from '@/lib/blog-store';
import {
  buildNewUserProfile,
  buildPlanUpdate,
  normalizePlan,
  type UserPlan,
  USER_PLAN_CONFIG,
} from '@/lib/user-plan';

const ADMIN_SECTIONS: AdminSection[] = [
  {
    title: 'Overview',
    href: '/admin',
    description: 'High-level platform health, admin metrics, and protected system status.',
    metric: 'Platform status',
  },
  {
    title: 'Users',
    href: '/admin/users',
    description: 'Search accounts, inspect access flags, and review account metadata safely.',
    metric: 'User directory',
  },
  {
    title: 'AI Usage',
    href: '/admin/ai-usage',
    description: 'Track Cue request volume, provider mix, token usage, and estimated cost.',
    metric: 'Cue telemetry',
  },
  {
    title: 'Blogs',
    href: '/admin/blogs',
    description: 'Create, edit, publish, feature, and retire Firestore-backed blog posts.',
    metric: 'Editorial tools',
  },
  {
    title: 'Revenue',
    href: '/admin/revenue',
    description: 'Record manual revenue and cost metrics until live billing integrations land.',
    metric: 'Manual finance',
  },
  {
    title: 'Security Logs',
    href: '/admin/security',
    description: 'Review audit trails, blocked admin access, rate limits, and API error signals.',
    metric: 'Audit trail',
  },
];

const PHP_PER_USD = Number(process.env.ADMIN_USD_TO_PHP || '56');
const ADMIN_DATA_EMPTY_WARNING =
  'Firebase Admin credentials are not configured. Add FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_CLIENT_EMAIL/FIREBASE_PRIVATE_KEY/FIREBASE_PROJECT_ID.';
const IS_DEV = process.env.NODE_ENV !== 'production';

function parseBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return ['true', '1', 'yes'].includes(value.toLowerCase());
  if (typeof value === 'number') return value > 0;
  return false;
}

function parseNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function parseNullableNumber(value: unknown): number | null {
  const parsed = parseNumber(value);
  return parsed > 0 ? parsed : null;
}

function normalizeIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate().toISOString();
  }
  return null;
}

function formatDetails(details: unknown): string {
  if (!details || typeof details !== 'object') return '—';
  const entries = Object.entries(details as Record<string, unknown>).filter(([, value]) => value !== undefined);
  if (entries.length === 0) return '—';
  return entries
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' · ');
}

function normalizeUserProfile(data: Record<string, unknown>) {
  const betaTester = parseBool(data.betaTester) || parseBool(data.isBetaTester) || parseBool(data.beta);
  const premiumAccess =
    parseBool(data.premiumAccess) || parseBool(data.isPremium) || false;
  const plan =
    typeof data.plan === 'string'
      ? data.plan
      : typeof data.accountType === 'string'
        ? data.accountType
        : typeof data.subscriptionPlan === 'string'
          ? data.subscriptionPlan
          : betaTester
            ? 'beta'
            : premiumAccess
              ? 'premium'
              : 'free';
  const normalizedPlan = String(plan).toLowerCase();
  const resolvedPremiumAccess = premiumAccess || normalizedPlan === 'premium' || normalizedPlan === 'beta';

  return {
    accountType:
      typeof data.accountType === 'string' && data.accountType.trim()
        ? data.accountType
        : betaTester
            ? 'beta'
            : resolvedPremiumAccess
              ? 'premium'
              : 'free',
    plan:
      typeof plan === 'string' && plan.trim()
        ? plan
        : betaTester
          ? 'beta'
          : resolvedPremiumAccess
            ? 'premium'
            : 'free',
    betaTester,
    premiumAccess: resolvedPremiumAccess,
    premiumAccessSource:
      typeof data.premiumAccessSource === 'string' ? data.premiumAccessSource : null,
    displayName:
      typeof data.displayName === 'string'
        ? data.displayName
        : typeof data.name === 'string'
          ? data.name
          : null,
    email: typeof data.email === 'string' ? data.email : null,
    createdAt: normalizeIso(data.createdAt),
    lastLogin: normalizeIso(data.lastLogin ?? data.lastLoginAt),
    storageUsedBytes: parseNullableNumber(
      data.storageUsedBytes ?? data.storageBytes ?? data.storageUsed ?? data.usedStorageBytes,
    ),
  };
}

function classifyUserCounts(users: AdminUserRow[]) {
  return users.reduce(
    (acc, user) => {
      const normalizedAccountType = user.accountType.toLowerCase();
      const normalizedPlan = user.plan.toLowerCase();
      if (normalizedAccountType === 'beta' || normalizedPlan === 'beta') {
        acc.betaUsers += 1;
      } else if (normalizedAccountType === 'premium' || normalizedPlan === 'premium') {
        acc.premiumUsers += 1;
      } else {
        acc.freeUsers += 1;
      }
      return acc;
    },
    { betaUsers: 0, freeUsers: 0, premiumUsers: 0 },
  );
}

export function adminSections(): AdminSection[] {
  return ADMIN_SECTIONS;
}

export function readAdminDataSourceStatus(): AdminDataSourceStatus {
  const status = readFirebaseAdminStatus();
  return {
    configured: status.configured,
    source: status.source,
    message: status.configured ? null : status.message ?? ADMIN_DATA_EMPTY_WARNING,
  };
}

function isRecoverableAdminDataError(error: unknown): boolean {
  return isFirebaseAdminCredentialError(error);
}

function emptyOverviewStats(): AdminOverviewStats {
  return {
    totalUsers: 0,
    betaUsers: 0,
    freeUsers: 0,
    premiumUsers: 0,
    aiRequestsToday: 0,
    publishedPosts: 0,
    netThisMonthPhp: 0,
    securityEventsToday: 0,
  };
}

export async function readAdminUsers(): Promise<AdminUsersResult> {
  const configured = readFirebaseAdminStatus().configured;
  if (IS_DEV) {
    console.info('[admin] firebase admin status', {
      initialized: configured,
      source: readFirebaseAdminStatus().source,
    });
  }

  if (!configured) {
    return {
      users: [],
      authUsersFetchedCount: 0,
      firestoreProfilesFetchedCount: 0,
      mergedUsersCount: 0,
      warning: readFirebaseAdminStatus().message ?? ADMIN_DATA_EMPTY_WARNING,
    };
  }

  try {
    const auth = getFirebaseAdminAuth();
    const db = getFirebaseAdminDb();
    const authUsers: Awaited<ReturnType<typeof auth.listUsers>>['users'] = [];

    let nextPageToken: string | undefined;
    do {
      const batch = await auth.listUsers(1000, nextPageToken);
      authUsers.push(...batch.users);
      nextPageToken = batch.pageToken;
    } while (nextPageToken);

    const refs = authUsers.map((user) => db.doc(`users/${user.uid}`));
    const userDocs = refs.length > 0 ? await db.getAll(...refs) : [];
    const users = authUsers.map((user, index) => {
      const docSnapshot = userDocs[index];
      const docData = docSnapshot?.data() ?? {};
      const profile = normalizeUserProfile(docData);
      const derivedAccountType =
        typeof docData.accountType === 'string'
          ? docData.accountType
          : typeof docData.plan === 'string'
            ? docData.plan
            : profile.betaTester
              ? 'beta'
              : profile.premiumAccess
                ? 'premium'
                : 'free';

      return {
        uid: user.uid,
        email: user.email ?? profile.email,
        displayName: user.displayName ?? profile.displayName,
        photoURL: user.photoURL ?? null,
        accountType: derivedAccountType,
        plan: profile.plan || derivedAccountType,
        betaTester: profile.betaTester,
        premiumAccess: profile.premiumAccess,
        premiumAccessSource: profile.premiumAccessSource,
        emailVerified: Boolean(user.emailVerified),
        disabled: Boolean(user.disabled),
        providerIds: user.providerData.map((provider) => provider.providerId).filter(Boolean),
        hasProfileDoc: Boolean(docSnapshot?.exists),
        createdAt: profile.createdAt ?? user.metadata.creationTime ?? null,
        lastLogin: profile.lastLogin ?? user.metadata.lastSignInTime ?? null,
        storageUsedBytes: profile.storageUsedBytes,
      } satisfies AdminUserRow;
    });

    const firestoreProfilesFetchedCount = userDocs.filter((doc) => doc.exists).length;

    if (IS_DEV) {
      console.info('[admin] users debug', {
        firebaseInitialized: true,
        authUsersFetchedCount: authUsers.length,
        firestoreProfilesFetchedCount,
        mergedUsersCount: users.length,
      });
    }

    return {
      users: users.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? ''))),
      authUsersFetchedCount: authUsers.length,
      firestoreProfilesFetchedCount,
      mergedUsersCount: users.length,
      warning: null,
    };
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : 'Unknown Firebase Auth error.';
    if (IS_DEV) {
      console.warn('[admin] users fetch failed', {
        firebaseInitialized: configured,
        error: message,
      });
    }
    if (isRecoverableAdminDataError(error)) {
      return {
        users: [],
        authUsersFetchedCount: 0,
        firestoreProfilesFetchedCount: 0,
        mergedUsersCount: 0,
        warning: `Could not read Firebase Auth users. ${message}`,
      };
    }
    throw error;
  }
}

export async function readAdminOverviewStats(): Promise<AdminOverviewStats & { usersWarning: string | null }> {
  try {
    const db = getFirebaseAdminDb();
    const today = dateKeyFromIso(isoNow());
    const monthStart = `${monthKeyFromIso(isoNow())}-01`;
    const usersResult = await readAdminUsers();
    const userCounts = classifyUserCounts(usersResult.users);

    const [aiTodayDoc, blogPosts, securityToday, revenueDocs] = await Promise.all([
      db.doc(`adminMetrics/aiUsage/daily/${today}`).get().catch(() => null),
      db.collection('blogPosts').where('status', '==', 'published').count().get().catch(() => null),
      db.collection('securityLogs').where('dateKey', '==', today).count().get().catch(() => null),
      db
        .collection('adminMetrics')
        .doc('revenue')
        .collection('monthly')
        .where(FieldPath.documentId(), '>=', monthStart.slice(0, 7))
        .get()
        .catch(() => null),
    ]);

    const netThisMonthPhp =
      revenueDocs?.docs.reduce((sum, doc) => sum + parseNumber(doc.data().netPhp), 0) ?? 0;

    return {
      totalUsers: usersResult.users.length,
      betaUsers: userCounts.betaUsers,
      freeUsers: userCounts.freeUsers,
      premiumUsers: userCounts.premiumUsers,
      aiRequestsToday: parseNumber(aiTodayDoc?.data()?.requests),
      publishedPosts: blogPosts?.data().count ?? 0,
      netThisMonthPhp,
      securityEventsToday: securityToday?.data().count ?? 0,
      usersWarning: usersResult.warning,
    };
  } catch (error) {
    if (isRecoverableAdminDataError(error)) {
      return {
        ...emptyOverviewStats(),
        usersWarning:
          error instanceof Error ? `Could not read Firebase Auth users. ${error.message}` : 'Could not read Firebase Auth users.',
      };
    }
    throw error;
  }
}

export async function listAdminUsers(): Promise<AdminUserRow[]> {
  const result = await readAdminUsers();
  return result.users;
}

export async function updateAdminUserPlan(params: {
  actorUid: string;
  actorEmail: string | null;
  uid: string;
  plan: UserPlan;
}) {
  if (!readFirebaseAdminStatus().configured) {
    throw new AdminConfigError(ADMIN_DATA_EMPTY_WARNING);
  }

  const auth = getFirebaseAdminAuth();
  const db = getFirebaseAdminDb();
  const authUser = await auth.getUser(params.uid);
  const ref = db.doc(`users/${params.uid}`);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? (snapshot.data() as Record<string, unknown>) : {};
  const currentProfile = normalizeUserProfile(existing);
  const previousPlan = normalizePlan(existing.plan ?? existing.accountType);
  const previousStorageLimitBytes =
    typeof existing.storageLimitBytes === 'number' && Number.isFinite(existing.storageLimitBytes)
      ? existing.storageLimitBytes
      : USER_PLAN_CONFIG[previousPlan].storageLimitBytes;
  const planUpdate = buildPlanUpdate(params.plan, {
    preserveBetaTester: currentProfile.betaTester,
    previousBetaJoinedAt:
      typeof existing.betaJoinedAt === 'string' ? existing.betaJoinedAt : null,
  });

  const baseProfile = snapshot.exists
    ? {
        uid: params.uid,
        email: authUser.email ?? currentProfile.email,
        displayName: authUser.displayName ?? currentProfile.displayName,
        photoURL: authUser.photoURL ?? (typeof existing.photoURL === 'string' ? existing.photoURL : null),
      }
    : buildNewUserProfile({
        uid: params.uid,
        email: authUser.email ?? null,
        displayName: authUser.displayName ?? null,
        photoURL: authUser.photoURL ?? null,
        plan: params.plan,
      });

  await ref.set(
    {
      ...baseProfile,
      ...planUpdate,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await writeAdminAuditLog({
    actorUid: params.actorUid,
    actorEmail: params.actorEmail,
    action: 'user_plan_update',
    targetType: 'user',
    targetId: params.uid,
    severity: 'info',
    metadata: {
      previousPlan,
      newPlan: params.plan,
      previousPremiumAccess: currentProfile.premiumAccess,
      newPremiumAccess: planUpdate.premiumAccess,
      previousStorageLimitBytes,
      newStorageLimitBytes: planUpdate.storageLimitBytes,
    },
  });

  revalidatePath('/admin');
  revalidatePath('/admin/users');

  return {
    previousPlan,
    newPlan: params.plan,
  };
}

function buildAiUsageLogRow(
  id: string,
  data: Record<string, unknown>,
): AdminUsageLogRow {
  return {
    id,
    uid: typeof data.uid === 'string' ? data.uid : 'unknown',
    provider: typeof data.provider === 'string' ? data.provider : 'unknown',
    model: typeof data.model === 'string' ? data.model : 'unknown',
    status:
      data.status === 'rate_limited' || data.status === 'error' || data.status === 'success'
        ? data.status
        : 'success',
    inputTokensEstimate: parseNumber(data.inputTokensEstimate),
    outputTokensEstimate: parseNumber(data.outputTokensEstimate),
    totalTokensEstimate: parseNumber(data.totalTokensEstimate),
    estimatedCostUsd: parseNumber(data.estimatedCostUsd),
    estimatedCostPhp: parseNumber(data.estimatedCostPhp),
    dateKey: typeof data.dateKey === 'string' ? data.dateKey : '',
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
    errorCode: typeof data.errorCode === 'string' ? data.errorCode : null,
  };
}

export async function readAiUsageDashboard(): Promise<AiUsageDashboard> {
  try {
    const db = getFirebaseAdminDb();
    const now = isoNow();
    const todayKey = dateKeyFromIso(now);
    const monthStart = `${monthKeyFromIso(now)}-01`;
    const thirtyDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [dailySnapshot, todayDoc, recentLogsSnapshot] = await Promise.all([
      db
        .doc('adminMetrics/aiUsage')
        .collection('daily')
        .where(FieldPath.documentId(), '>=', thirtyDaysAgo)
        .where(FieldPath.documentId(), '<=', todayKey)
        .get()
        .catch(() => null),
      db.doc(`adminMetrics/aiUsage/daily/${todayKey}`).get().catch(() => null),
      db.collection('aiUsageLogs').orderBy('createdAt', 'desc').limit(50).get().catch(() => null),
    ]);

  const dailyRows =
    dailySnapshot?.docs
      .map((doc) => {
        const data = doc.data();
        return {
          dateKey: doc.id,
          requests: parseNumber(data.totalRequests ?? data.requests),
          tokens: parseNumber(data.totalTokens ?? data.totalTokensEstimate),
          costPhp: parseNumber(data.totalEstimatedCostPhp ?? data.estimatedCostPhp),
          providers: {
            groq: parseNumber(data.groqRequests ?? data.providerGroqRequests),
            gemini: parseNumber(data.geminiRequests ?? data.providerGeminiRequests),
          },
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey)) ?? [];

  const monthRows = dailyRows.filter((row) => row.dateKey >= monthStart);
  const month = monthRows.reduce(
    (acc, row) => ({
      requests: acc.requests + row.requests,
      tokens: acc.tokens + row.tokens,
      costUsd:
        acc.costUsd +
        parseNumber(
          (dailySnapshot?.docs.find((doc) => doc.id === row.dateKey)?.data() ?? {}).totalEstimatedCostUsd ??
            (dailySnapshot?.docs.find((doc) => doc.id === row.dateKey)?.data() ?? {}).estimatedCostUsd,
        ),
      costPhp: acc.costPhp + row.costPhp,
    }),
    { requests: 0, tokens: 0, costUsd: 0, costPhp: 0 },
  );

  const providerTotals = monthRows.reduce(
    (acc, row) => {
      acc.groq.requests += row.providers.groq;
      acc.groq.tokens += row.tokens * (row.providers.groq > 0 ? row.providers.groq / Math.max(row.requests, 1) : 0);
      acc.groq.costPhp += row.costPhp * (row.providers.groq > 0 ? row.providers.groq / Math.max(row.requests, 1) : 0);
      acc.gemini.requests += row.providers.gemini;
      acc.gemini.tokens += row.tokens * (row.providers.gemini > 0 ? row.providers.gemini / Math.max(row.requests, 1) : 0);
      acc.gemini.costPhp += row.costPhp * (row.providers.gemini > 0 ? row.providers.gemini / Math.max(row.requests, 1) : 0);
      return acc;
    },
    {
      groq: { provider: 'Groq', requests: 0, tokens: 0, costPhp: 0 },
      gemini: { provider: 'Gemini', requests: 0, tokens: 0, costPhp: 0 },
    },
  );

  const recentLogs =
    recentLogsSnapshot?.docs.map((doc) => buildAiUsageLogRow(doc.id, doc.data())).filter(Boolean) ?? [];
  const todayData = todayDoc?.data() ?? {};
  const fallbackToday = recentLogs.reduce(
    (acc, log) => {
      if (log.dateKey !== todayKey) return acc;
      acc.requests += 1;
      acc.tokens += log.totalTokensEstimate;
      acc.costUsd += log.estimatedCostUsd;
      acc.costPhp += log.estimatedCostPhp;
      acc.errors += log.status === 'error' ? 1 : 0;
      acc.rateLimitHits += log.status === 'rate_limited' ? 1 : 0;
      return acc;
    },
    { requests: 0, tokens: 0, costUsd: 0, costPhp: 0, errors: 0, rateLimitHits: 0 },
  );
  const fallbackMonth = recentLogs.reduce(
    (acc, log) => {
      if (log.dateKey < monthStart) return acc;
      acc.requests += 1;
      acc.tokens += log.totalTokensEstimate;
      acc.costUsd += log.estimatedCostUsd;
      acc.costPhp += log.estimatedCostPhp;
      return acc;
    },
    { requests: 0, tokens: 0, costUsd: 0, costPhp: 0 },
  );
  const fallbackProviderSplit = recentLogs.reduce(
    (acc, log) => {
      const key = log.provider.toLowerCase() === 'groq' ? 'groq' : log.provider.toLowerCase() === 'gemini' ? 'gemini' : null;
      if (!key) return acc;
      acc[key].requests += 1;
      acc[key].tokens += log.totalTokensEstimate;
      acc[key].costPhp += log.estimatedCostPhp;
      return acc;
    },
    {
      groq: { provider: 'Groq', requests: 0, tokens: 0, costPhp: 0 },
      gemini: { provider: 'Gemini', requests: 0, tokens: 0, costPhp: 0 },
    },
  );

    return {
      today: {
        requests: parseNumber(todayData.totalRequests ?? todayData.requests) || fallbackToday.requests,
        tokens: parseNumber(todayData.totalTokens ?? todayData.totalTokensEstimate) || fallbackToday.tokens,
        costUsd: parseNumber(todayData.totalEstimatedCostUsd ?? todayData.estimatedCostUsd) || fallbackToday.costUsd,
        costPhp: parseNumber(todayData.totalEstimatedCostPhp ?? todayData.estimatedCostPhp) || fallbackToday.costPhp,
        errors: parseNumber(todayData.errorCount ?? todayData.errors) || fallbackToday.errors,
        rateLimitHits: parseNumber(todayData.rateLimitHits) || fallbackToday.rateLimitHits,
      },
      month: month.requests > 0 ? month : fallbackMonth,
      daily: dailyRows,
      providerSplit:
        providerTotals.groq.requests > 0 || providerTotals.gemini.requests > 0
          ? [providerTotals.groq, providerTotals.gemini]
          : [fallbackProviderSplit.groq, fallbackProviderSplit.gemini],
      recentLogs,
    };
  } catch (error) {
    if (isRecoverableAdminDataError(error)) {
      return {
        today: { requests: 0, tokens: 0, costUsd: 0, costPhp: 0, errors: 0, rateLimitHits: 0 },
        month: { requests: 0, tokens: 0, costUsd: 0, costPhp: 0 },
        daily: [],
        providerSplit: [
          { provider: 'Groq', requests: 0, tokens: 0, costPhp: 0 },
          { provider: 'Gemini', requests: 0, tokens: 0, costPhp: 0 },
        ],
        recentLogs: [],
      };
    }
    throw error;
  }
}

export async function recordAiUsageLog(params: {
  uid: string;
  email?: string | null;
  authenticated?: boolean;
  provider: 'groq' | 'gemini';
  model: string;
  status: 'success' | 'error' | 'rate_limited';
  requestPayload: unknown;
  responseText?: string;
  errorCode?: string | null;
}) {
  const inputTokensEstimate = estimateTokensFromCuePayload(params.requestPayload);
  const outputTokensEstimate = estimateTokensFromText(params.responseText ?? '');
  const totalTokensEstimate = inputTokensEstimate + outputTokensEstimate;
  const estimatedCostUsd = estimateUsdCost({
    provider: params.provider,
    inputTokens: inputTokensEstimate,
    outputTokens: outputTokensEstimate,
  });
  const estimatedCostPhp = estimatedCostUsd * PHP_PER_USD;
  return logCueUsage({
    uid: params.uid,
    email: params.email ?? null,
    authenticated: params.authenticated,
    provider: params.provider,
    model: params.model,
    status: params.status,
    inputTokensEstimate,
    outputTokensEstimate,
    totalTokensEstimate,
    estimatedCostUsd,
    estimatedCostPhp,
    errorCode: params.errorCode ?? null,
  });
}

function buildRevenueMetric(key: string, scope: 'daily' | 'monthly', data: Record<string, unknown>): RevenueMetric {
  return {
    key,
    scope,
    adsRevenuePhp: parseNumber(data.adsRevenuePhp),
    premiumRevenuePhp: parseNumber(data.premiumRevenuePhp),
    otherRevenuePhp: parseNumber(data.otherRevenuePhp),
    groqCostPhp: parseNumber(data.groqCostPhp),
    geminiCostPhp: parseNumber(data.geminiCostPhp),
    firebaseCostPhp: parseNumber(data.firebaseCostPhp),
    vercelCostPhp: parseNumber(data.vercelCostPhp),
    otherCostPhp: parseNumber(data.otherCostPhp),
    netPhp: parseNumber(data.netPhp),
    notes: typeof data.notes === 'string' ? data.notes : '',
    updatedAt: normalizeIso(data.updatedAt),
  };
}

export async function readRevenueDashboard(): Promise<RevenueDashboard> {
  try {
    const db = getFirebaseAdminDb();
    const [dailySnapshot, monthlySnapshot] = await Promise.all([
      db.doc('adminMetrics/revenue').collection('daily').orderBy(FieldPath.documentId(), 'desc').limit(30).get().catch(() => null),
      db.doc('adminMetrics/revenue').collection('monthly').orderBy(FieldPath.documentId(), 'desc').limit(12).get().catch(() => null),
    ]);

  const daily =
    dailySnapshot?.docs.map((doc) => buildRevenueMetric(doc.id, 'daily', doc.data())).sort((a, b) => b.key.localeCompare(a.key)) ?? [];
  const monthly =
    monthlySnapshot?.docs.map((doc) => buildRevenueMetric(doc.id, 'monthly', doc.data())).sort((a, b) => b.key.localeCompare(a.key)) ?? [];

  const source = monthly.length > 0 ? monthly : daily;
  const totals = source.reduce(
    (acc, metric) => {
      const revenue = metric.adsRevenuePhp + metric.premiumRevenuePhp + metric.otherRevenuePhp;
      const cost = metric.groqCostPhp + metric.geminiCostPhp + metric.firebaseCostPhp + metric.vercelCostPhp + metric.otherCostPhp;
      acc.revenuePhp += revenue;
      acc.costPhp += cost;
      acc.netPhp += metric.netPhp;
      return acc;
    },
    { revenuePhp: 0, costPhp: 0, netPhp: 0 },
  );

    return { totals, daily, monthly };
  } catch (error) {
    if (isRecoverableAdminDataError(error)) {
      return { totals: { revenuePhp: 0, costPhp: 0, netPhp: 0 }, daily: [], monthly: [] };
    }
    throw error;
  }
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function parseMoneyField(formData: FormData, key: string): number {
  const value = formValue(formData, key);
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function saveRevenueMetricAction(formData: FormData) {
  'use server';

  const actor = await requireAdminUser({ nextPath: '/admin/revenue', onUnauthorized: 'notFound' });
  if (!readFirebaseAdminStatus().configured) {
    throw new AdminConfigError(ADMIN_DATA_EMPTY_WARNING);
  }
  const scope = formValue(formData, 'scope') === 'monthly' ? 'monthly' : 'daily';
  const key = formValue(formData, 'key') || (scope === 'monthly' ? monthKeyFromIso(isoNow()) : dateKeyFromIso(isoNow()));
  const adsRevenuePhp = parseMoneyField(formData, 'adsRevenuePhp');
  const premiumRevenuePhp = parseMoneyField(formData, 'premiumRevenuePhp');
  const otherRevenuePhp = parseMoneyField(formData, 'otherRevenuePhp');
  const groqCostPhp = parseMoneyField(formData, 'groqCostPhp');
  const geminiCostPhp = parseMoneyField(formData, 'geminiCostPhp');
  const firebaseCostPhp = parseMoneyField(formData, 'firebaseCostPhp');
  const vercelCostPhp = parseMoneyField(formData, 'vercelCostPhp');
  const otherCostPhp = parseMoneyField(formData, 'otherCostPhp');
  const notes = formValue(formData, 'notes');
  const netPhp =
    adsRevenuePhp +
    premiumRevenuePhp +
    otherRevenuePhp -
    groqCostPhp -
    geminiCostPhp -
    firebaseCostPhp -
    vercelCostPhp -
    otherCostPhp;

  await getFirebaseAdminDb()
    .doc(`adminMetrics/revenue/${scope}/${key}`)
    .set(
      {
        adsRevenuePhp,
        premiumRevenuePhp,
        otherRevenuePhp,
        groqCostPhp,
        geminiCostPhp,
        firebaseCostPhp,
        vercelCostPhp,
        otherCostPhp,
        netPhp,
        notes,
        updatedAt: isoNow(),
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await writeAdminAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: 'revenue_metric_upsert',
    targetType: 'revenue_metric',
    targetId: `${scope}:${key}`,
    severity: 'info',
    metadata: {
      scope,
      key,
      netPhp,
    },
  });

  revalidatePath('/admin/revenue');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function saveBlogPostAction(formData: FormData) {
  'use server';

  const actor = await requireAdminUser({ nextPath: '/admin/blogs', onUnauthorized: 'notFound' });
  if (!readFirebaseAdminStatus().configured) {
    throw new AdminConfigError(ADMIN_DATA_EMPTY_WARNING);
  }
  const postId = formValue(formData, 'postId');
  const title = formValue(formData, 'title');
  const slug = slugify(formValue(formData, 'slug') || title);
  const excerpt = formValue(formData, 'excerpt');
  const content = formValue(formData, 'content');
  const seoTitle = formValue(formData, 'seoTitle');
  const seoDescription = formValue(formData, 'seoDescription');
  const status = formValue(formData, 'status') === 'published' ? 'published' : 'draft';
  const featured = formValue(formData, 'featured') === 'on';

  if (!title || !slug || !content) {
    throw new Error('Title, slug, and content are required.');
  }
  if (await isBlogSlugTaken(slug, postId || undefined)) {
    throw new Error('That blog slug is already in use.');
  }

  const db = getFirebaseAdminDb();
  const ref = postId ? db.collection('blogPosts').doc(postId) : db.collection('blogPosts').doc();
  const existing = postId ? await getAdminBlogPostById(postId) : null;
  const createdAt = existing?.createdAt ?? isoNow();
  const publishedAt =
    status === 'published' ? existing?.publishedAt ?? isoNow() : null;

  await ref.set(
    {
      title,
      slug,
      excerpt,
      content,
      status,
      author: actor.email ?? actor.uid,
      createdAt,
      updatedAt: isoNow(),
      publishedAt,
      seoTitle,
      seoDescription,
      featured,
      serverTimestamp: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await writeAdminAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: postId ? 'blog_update' : 'blog_create',
    targetType: 'blog_post',
    targetId: ref.id,
    severity: 'info',
    metadata: { slug, status, featured },
  });

  revalidatePath('/admin/blogs');
  revalidatePath('/blog');
  revalidatePath(`/blog/${slug}`);
}

export async function deleteBlogPostAction(formData: FormData) {
  'use server';

  const actor = await requireAdminUser({ nextPath: '/admin/blogs', onUnauthorized: 'notFound' });
  if (!readFirebaseAdminStatus().configured) {
    throw new AdminConfigError(ADMIN_DATA_EMPTY_WARNING);
  }
  const postId = formValue(formData, 'postId');
  if (!postId) throw new Error('Missing post id.');
  const existing = await getAdminBlogPostById(postId);
  await getFirebaseAdminDb().collection('blogPosts').doc(postId).delete();

  await writeAdminAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: 'blog_delete',
    targetType: 'blog_post',
    targetId: postId,
    severity: 'warning',
    metadata: { slug: existing?.slug ?? null, title: existing?.title ?? null },
  });

  revalidatePath('/admin/blogs');
  revalidatePath('/blog');
  if (existing?.slug) revalidatePath(`/blog/${existing.slug}`);
}

export async function toggleBlogPublishAction(formData: FormData) {
  'use server';

  const actor = await requireAdminUser({ nextPath: '/admin/blogs', onUnauthorized: 'notFound' });
  if (!readFirebaseAdminStatus().configured) {
    throw new AdminConfigError(ADMIN_DATA_EMPTY_WARNING);
  }
  const postId = formValue(formData, 'postId');
  const nextStatus = formValue(formData, 'nextStatus') === 'published' ? 'published' : 'draft';
  if (!postId) throw new Error('Missing post id.');
  const existing = await getAdminBlogPostById(postId);
  if (!existing) throw new Error('Blog post not found.');

  await getFirebaseAdminDb()
    .collection('blogPosts')
    .doc(postId)
    .set(
      {
        status: nextStatus,
        updatedAt: isoNow(),
        publishedAt: nextStatus === 'published' ? existing.publishedAt ?? isoNow() : null,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await writeAdminAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: nextStatus === 'published' ? 'blog_publish' : 'blog_unpublish',
    targetType: 'blog_post',
    targetId: postId,
    metadata: { slug: existing.slug },
  });

  revalidatePath('/admin/blogs');
  revalidatePath('/blog');
  revalidatePath(`/blog/${existing.slug}`);
}

export async function toggleBlogFeaturedAction(formData: FormData) {
  'use server';

  const actor = await requireAdminUser({ nextPath: '/admin/blogs', onUnauthorized: 'notFound' });
  if (!readFirebaseAdminStatus().configured) {
    throw new AdminConfigError(ADMIN_DATA_EMPTY_WARNING);
  }
  const postId = formValue(formData, 'postId');
  const featured = formValue(formData, 'featured') === 'true';
  if (!postId) throw new Error('Missing post id.');
  const existing = await getAdminBlogPostById(postId);
  if (!existing) throw new Error('Blog post not found.');

  await getFirebaseAdminDb()
    .collection('blogPosts')
    .doc(postId)
    .set(
      {
        featured,
        updatedAt: isoNow(),
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

  await writeAdminAuditLog({
    actorUid: actor.uid,
    actorEmail: actor.email,
    action: featured ? 'blog_feature' : 'blog_unfeature',
    targetType: 'blog_post',
    targetId: postId,
    metadata: { slug: existing.slug },
  });

  revalidatePath('/admin/blogs');
  revalidatePath('/blog');
  revalidatePath(`/blog/${existing.slug}`);
}

export async function readAdminBlogs(): Promise<ManagedBlogPost[]> {
  return getAdminBlogPosts();
}

export async function readSecurityDashboard(): Promise<{
  todayCounts: {
    failedAdminAttempts: number;
    rateLimitHits: number;
    apiErrors: number;
    permissionErrors: number;
    criticalEvents: number;
  };
  events: SecurityEventRow[];
}> {
  try {
    const db = getFirebaseAdminDb();
    const today = dateKeyFromIso(isoNow());
    const [securitySnapshot, auditSnapshot] = await Promise.all([
      db.collection('securityLogs').orderBy('createdAt', 'desc').limit(80).get().catch(() => null),
      db.collection('adminAuditLogs').orderBy('createdAt', 'desc').limit(40).get().catch(() => null),
    ]);

  const securityRows =
    securitySnapshot?.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        time: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
        severity: typeof data.severity === 'string' ? data.severity : 'warning',
        actor: typeof data.actor === 'string' ? data.actor : 'unknown',
        action: typeof data.action === 'string' ? data.action : 'unknown',
        target: typeof data.target === 'string' ? data.target : '—',
        details: formatDetails(data.details),
      };
    }) ?? [];

  const auditRows =
    auditSnapshot?.docs.map((doc) => {
      const data = doc.data();
      return {
        id: `audit-${doc.id}`,
        time: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
        severity: typeof data.severity === 'string' ? data.severity : 'info',
        actor: typeof data.actorEmail === 'string' ? data.actorEmail : typeof data.actorUid === 'string' ? data.actorUid : 'admin',
        action: typeof data.action === 'string' ? data.action : 'admin_action',
        target: typeof data.targetId === 'string' ? data.targetId : '—',
        details: formatDetails(data.metadata),
      };
    }) ?? [];

    const todaySecurityRows = securityRows.filter((row) => row.time.startsWith(today));
    return {
      todayCounts: {
        failedAdminAttempts: todaySecurityRows.filter((row) => row.action.includes('failed_admin')).length,
        rateLimitHits: todaySecurityRows.filter((row) => row.action.includes('rate_limited')).length,
        apiErrors: todaySecurityRows.filter((row) => row.action.includes('error')).length,
        permissionErrors: todaySecurityRows.filter(
          (row) => row.action.includes('permission') || row.action.includes('failed_admin'),
        ).length,
        criticalEvents: todaySecurityRows.filter((row) => row.severity === 'critical').length,
      },
      events: [...securityRows, ...auditRows].sort((a, b) => b.time.localeCompare(a.time)),
    };
  } catch (error) {
    if (isRecoverableAdminDataError(error)) {
      return {
        todayCounts: {
          failedAdminAttempts: 0,
          rateLimitHits: 0,
          apiErrors: 0,
          permissionErrors: 0,
          criticalEvents: 0,
        },
        events: [],
      };
    }
    throw error;
  }
}
