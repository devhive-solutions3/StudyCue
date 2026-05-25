import { getPlanConfig, normalizePlan, type UserPlan, type UserPlanConfig } from '@/lib/user-plan';

type ProfileLike = {
  accountType?: unknown;
  plan?: unknown;
  premiumAccess?: unknown;
  betaTester?: unknown;
  adsEnabled?: unknown;
  storageLimitBytes?: unknown;
  maxUploadInputBytes?: unknown;
  maxStoredFileBytes?: unknown;
  cueDailyLimit?: unknown;
  scheduleImageImportsMonthly?: unknown;
  advancedStatsEnabled?: unknown;
  exportReportsEnabled?: unknown;
  customThemesEnabled?: unknown;
  customAccentColorsEnabled?: unknown;
  customFocusSoundsEnabled?: unknown;
  groupPlanningEnabled?: unknown;
};

function readBoolean(value: unknown, fallback: boolean) {
  if (typeof value === 'boolean') return value;
  return fallback;
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function getUserPlan(profile: ProfileLike | null | undefined): UserPlan {
  return normalizePlan(profile?.plan ?? profile?.accountType);
}

export function getPlanConfigForProfile(profile: ProfileLike | null | undefined): UserPlanConfig {
  return getPlanConfig(getUserPlan(profile));
}

export function hasPremiumAccess(profile: ProfileLike | null | undefined) {
  const plan = getUserPlan(profile);
  if (plan === 'beta' || plan === 'premium') return true;
  return readBoolean(profile?.premiumAccess, false);
}

export function isBetaTester(profile: ProfileLike | null | undefined) {
  const plan = getUserPlan(profile);
  if (plan === 'beta') return true;
  return readBoolean(profile?.betaTester, false);
}

export function shouldShowAds(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).adsEnabled;
  return readBoolean(profile?.adsEnabled, fallback);
}

export function getStorageLimitBytes(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).storageLimitBytes;
  return readNumber(profile?.storageLimitBytes, fallback);
}

export function getStorageLimit(profile: ProfileLike | null | undefined) {
  return getStorageLimitBytes(profile);
}

export function getMaxUploadInputBytes(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).maxUploadInputBytes;
  return readNumber(profile?.maxUploadInputBytes, fallback);
}

export function getMaxStoredFileBytes(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).maxStoredFileBytes;
  return readNumber(profile?.maxStoredFileBytes, fallback);
}

export function getCueDailyLimit(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).cueDailyLimit;
  return readNumber(profile?.cueDailyLimit, fallback);
}

export function getScheduleImageImportLimit(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).scheduleImageImportsMonthly;
  return readNumber(profile?.scheduleImageImportsMonthly, fallback);
}

export function canUseAdvancedStats(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).advancedStatsEnabled;
  return readBoolean(profile?.advancedStatsEnabled, fallback);
}

export function canExportReports(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).exportReportsEnabled;
  return readBoolean(profile?.exportReportsEnabled, fallback);
}

export function canUseCustomThemes(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).customThemesEnabled;
  return readBoolean(profile?.customThemesEnabled, fallback);
}

export function canUseCustomAccentColors(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).customAccentColorsEnabled;
  return readBoolean(profile?.customAccentColorsEnabled, fallback);
}

export function canUseCustomFocusSounds(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).customFocusSoundsEnabled;
  return readBoolean(profile?.customFocusSoundsEnabled, fallback);
}

export function canUseGroupPlanning(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfigForProfile(profile).groupPlanningEnabled;
  return readBoolean(profile?.groupPlanningEnabled, fallback);
}

export function canUploadFile(
  profile: ProfileLike | null | undefined,
  currentStorageUsedBytes: number,
  newFileSize: number,
) {
  const inputLimit = getMaxUploadInputBytes(profile);
  const storedLimit = getMaxStoredFileBytes(profile);
  const storageLimit = getStorageLimitBytes(profile);

  return {
    allowed:
      newFileSize <= inputLimit &&
      newFileSize <= storedLimit &&
      currentStorageUsedBytes + newFileSize <= storageLimit,
    reasons: {
      exceedsInputLimit: newFileSize > inputLimit,
      exceedsStoredFileLimit: newFileSize > storedLimit,
      exceedsStorageLimit: currentStorageUsedBytes + newFileSize > storageLimit,
    },
  };
}
