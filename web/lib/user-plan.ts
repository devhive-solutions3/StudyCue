import { isBetaSignupsEnabled } from '@/lib/beta-config';

export type UserPlan = 'free' | 'beta' | 'premium';
export type PremiumAccessSource = 'beta' | 'manual' | 'subscription' | null;

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const USER_PLAN_CONFIG = {
  free: {
    label: 'Free',
    accountType: 'free',
    storageLimitBytes: 100 * MB,
    maxUploadInputBytes: 4 * MB,
    maxStoredFileBytes: 2 * MB,
    cueDailyLimit: 30,
    cueBurstLimit: 20,
    cueBurstWindowMinutes: 10,
    adsEnabled: true,
    premiumAccess: false,
    betaTester: false,
    premiumAccessSource: null,
  },
  beta: {
    label: 'Beta',
    accountType: 'beta',
    storageLimitBytes: 1 * GB,
    maxUploadInputBytes: 10 * MB,
    maxStoredFileBytes: 5 * MB,
    cueDailyLimit: 100,
    cueBurstLimit: 20,
    cueBurstWindowMinutes: 10,
    adsEnabled: false,
    premiumAccess: true,
    betaTester: true,
    premiumAccessSource: 'beta',
  },
  premium: {
    label: 'Premium',
    accountType: 'premium',
    storageLimitBytes: 5 * GB,
    maxUploadInputBytes: 20 * MB,
    maxStoredFileBytes: 10 * MB,
    cueDailyLimit: 300,
    cueBurstLimit: 20,
    cueBurstWindowMinutes: 10,
    adsEnabled: false,
    premiumAccess: true,
    betaTester: false,
    premiumAccessSource: 'manual',
  },
} as const;

export function normalizePlan(value: unknown): UserPlan {
  return value === 'beta' || value === 'premium' ? value : 'free';
}

export function getPlanConfig(plan: UserPlan) {
  return USER_PLAN_CONFIG[plan];
}

export function buildPlanFields(
  plan: UserPlan,
  options?: {
    preserveBetaTester?: boolean;
    previousBetaJoinedAt?: string | null;
    premiumAccessSource?: PremiumAccessSource;
  },
) {
  const config = getPlanConfig(plan);

  return {
    accountType: config.accountType,
    plan,
    betaTester:
      plan === 'premium' && options?.preserveBetaTester ? true : config.betaTester,
    betaJoinedAt:
      plan === 'beta'
        ? options?.previousBetaJoinedAt ?? new Date().toISOString()
        : null,
    premiumAccess: config.premiumAccess,
    premiumAccessSource: options?.premiumAccessSource ?? config.premiumAccessSource,
    storageLimitBytes: config.storageLimitBytes,
    maxUploadInputBytes: config.maxUploadInputBytes,
    maxStoredFileBytes: config.maxStoredFileBytes,
    cueDailyLimit: config.cueDailyLimit,
    cueBurstLimit: config.cueBurstLimit,
    cueBurstWindowMinutes: config.cueBurstWindowMinutes,
    adsEnabled: config.adsEnabled,
  };
}

export function buildNewUserProfile(params: {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  plan?: UserPlan;
}) {
  const selectedPlan = params.plan ?? (isBetaSignupsEnabled() ? 'beta' : 'free');
  const nowIso = new Date().toISOString();

  return {
    uid: params.uid,
    email: params.email ?? null,
    displayName: params.displayName ?? null,
    photoURL: params.photoURL ?? null,
    storageUsedBytes: 0,
    ...buildPlanFields(selectedPlan),
    createdAt: nowIso,
    updatedAt: nowIso,
    lastLoginAt: nowIso,
  };
}

export function buildPlanUpdate(
  plan: UserPlan,
  options?: {
    preserveBetaTester?: boolean;
    previousBetaJoinedAt?: string | null;
    premiumAccessSource?: PremiumAccessSource;
  },
) {
  return {
    ...buildPlanFields(plan, options),
    updatedAt: new Date().toISOString(),
  };
}

