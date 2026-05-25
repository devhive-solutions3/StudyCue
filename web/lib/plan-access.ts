import { getPlanConfig, normalizePlan } from '@/lib/user-plan';

type ProfileLike = {
  accountType?: unknown;
  plan?: unknown;
  premiumAccess?: unknown;
  adsEnabled?: unknown;
  storageLimitBytes?: unknown;
  maxUploadInputBytes?: unknown;
  maxStoredFileBytes?: unknown;
  cueDailyLimit?: unknown;
};

function readPlan(profile: ProfileLike | null | undefined) {
  return normalizePlan(profile?.plan ?? profile?.accountType);
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function hasPremiumAccess(profile: ProfileLike | null | undefined) {
  const plan = readPlan(profile);
  if (plan === 'beta' || plan === 'premium') return true;
  return Boolean(profile?.premiumAccess);
}

export function shouldShowAds(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfig(readPlan(profile)).adsEnabled;
  return typeof profile?.adsEnabled === 'boolean' ? profile.adsEnabled : fallback;
}

export function getStorageLimit(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfig(readPlan(profile)).storageLimitBytes;
  return readNumber(profile?.storageLimitBytes, fallback);
}

export function getCueDailyLimit(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfig(readPlan(profile)).cueDailyLimit;
  return readNumber(profile?.cueDailyLimit, fallback);
}

export function getMaxUploadInputBytes(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfig(readPlan(profile)).maxUploadInputBytes;
  return readNumber(profile?.maxUploadInputBytes, fallback);
}

export function getMaxStoredFileBytes(profile: ProfileLike | null | undefined) {
  const fallback = getPlanConfig(readPlan(profile)).maxStoredFileBytes;
  return readNumber(profile?.maxStoredFileBytes, fallback);
}

export function canUploadFile(
  profile: ProfileLike | null | undefined,
  currentStorageUsedBytes: number,
  newFileSize: number,
) {
  const inputLimit = getMaxUploadInputBytes(profile);
  const storedLimit = getMaxStoredFileBytes(profile);
  const storageLimit = getStorageLimit(profile);

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

