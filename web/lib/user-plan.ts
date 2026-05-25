import { isBetaSignupsEnabled } from '@/lib/beta-config';

export type UserPlan = 'free' | 'beta' | 'premium';
export type PremiumAccessSource = 'beta' | 'manual' | 'subscription' | null;

const MB = 1024 * 1024;
const GB = 1024 * 1024 * 1024;

export const FREE_PLAN_FEATURES = [
  'Dashboard',
  'Calendar',
  'Tasks',
  'Notes',
  'Focus timer',
  'Cue AI with planning context',
  'Basic stats',
  'Cloud sync',
  'Limited storage',
  'Limited Cue usage',
  'Limited schedule image imports',
  'Ads supported',
] as const;

export const STUDYCUE_PLUS_FEATURES = [
  'No ads',
  '5 GB notes/file storage',
  'Higher Cue AI daily limit',
  'More schedule image imports',
  'Advanced stats and longer history',
  'Custom accent colors',
  'More dashboard themes',
  'Custom focus timer sounds',
  'Export tasks, calendar, and focus stats',
  'Download study reports',
  'Backup notes metadata',
  'CSV/PDF report export',
  'Group planning access, future feature',
  'Early access to future premium tools',
] as const;

export const BETA_PLAN_FEATURES = STUDYCUE_PLUS_FEATURES;

export const USER_PLAN_CONFIG = {
  free: {
    label: 'Free',
    displayName: 'Free',
    pricePhpMonthly: 0,
    accountType: 'free',
    plan: 'free',
    storageLimitBytes: 100 * MB,
    maxUploadInputBytes: 4 * MB,
    maxStoredFileBytes: 2 * MB,
    cueDailyLimit: 30,
    cueBurstLimit: 20,
    cueBurstWindowMinutes: 10,
    scheduleImageImportsMonthly: 3,
    adsEnabled: true,
    premiumAccess: false,
    betaTester: false,
    premiumAccessSource: null,
    advancedStatsEnabled: false,
    exportReportsEnabled: false,
    customThemesEnabled: false,
    customAccentColorsEnabled: false,
    customFocusSoundsEnabled: false,
    groupPlanningEnabled: false,
    earlyAccessEnabled: false,
    featureList: FREE_PLAN_FEATURES,
  },
  beta: {
    label: 'Beta',
    displayName: 'Beta Tester',
    pricePhpMonthly: 0,
    accountType: 'beta',
    plan: 'beta',
    storageLimitBytes: 1 * GB,
    maxUploadInputBytes: 10 * MB,
    maxStoredFileBytes: 5 * MB,
    cueDailyLimit: 100,
    cueBurstLimit: 20,
    cueBurstWindowMinutes: 10,
    scheduleImageImportsMonthly: 25,
    adsEnabled: false,
    premiumAccess: true,
    betaTester: true,
    premiumAccessSource: 'beta',
    advancedStatsEnabled: true,
    exportReportsEnabled: true,
    customThemesEnabled: true,
    customAccentColorsEnabled: true,
    customFocusSoundsEnabled: true,
    groupPlanningEnabled: true,
    earlyAccessEnabled: true,
    featureList: BETA_PLAN_FEATURES,
  },
  premium: {
    label: 'Premium',
    displayName: 'StudyCue Plus',
    pricePhpMonthly: 99,
    accountType: 'premium',
    plan: 'premium',
    storageLimitBytes: 5 * GB,
    maxUploadInputBytes: 20 * MB,
    maxStoredFileBytes: 10 * MB,
    cueDailyLimit: 300,
    cueBurstLimit: 20,
    cueBurstWindowMinutes: 10,
    scheduleImageImportsMonthly: 100,
    adsEnabled: false,
    premiumAccess: true,
    betaTester: false,
    premiumAccessSource: 'manual',
    advancedStatsEnabled: true,
    exportReportsEnabled: true,
    customThemesEnabled: true,
    customAccentColorsEnabled: true,
    customFocusSoundsEnabled: true,
    groupPlanningEnabled: true,
    earlyAccessEnabled: true,
    featureList: STUDYCUE_PLUS_FEATURES,
  },
} as const;

export type UserPlanConfig = (typeof USER_PLAN_CONFIG)[UserPlan];

export function normalizePlan(value: unknown): UserPlan {
  return value === 'beta' || value === 'premium' ? value : 'free';
}

export function getPlanConfig(plan: UserPlan): UserPlanConfig {
  return USER_PLAN_CONFIG[plan];
}

export function buildPlanFields(
  plan: UserPlan,
  options?: {
    previousBetaJoinedAt?: string | null;
    premiumAccessSource?: PremiumAccessSource;
  },
) {
  const config = getPlanConfig(plan);

  return {
    accountType: config.accountType,
    plan: config.plan,
    pricePhpMonthly: config.pricePhpMonthly,
    betaTester: config.betaTester,
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
    scheduleImageImportsMonthly: config.scheduleImageImportsMonthly,
    adsEnabled: config.adsEnabled,
    advancedStatsEnabled: config.advancedStatsEnabled,
    exportReportsEnabled: config.exportReportsEnabled,
    customThemesEnabled: config.customThemesEnabled,
    customAccentColorsEnabled: config.customAccentColorsEnabled,
    customFocusSoundsEnabled: config.customFocusSoundsEnabled,
    groupPlanningEnabled: config.groupPlanningEnabled,
    earlyAccessEnabled: config.earlyAccessEnabled,
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
    previousBetaJoinedAt?: string | null;
    premiumAccessSource?: PremiumAccessSource;
  },
) {
  return {
    ...buildPlanFields(plan, options),
    updatedAt: new Date().toISOString(),
  };
}
