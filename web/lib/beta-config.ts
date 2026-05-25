const DEFAULT_BETA_SIGNUPS_ENABLED = true;

export type BetaSignupMode = {
  enabled: boolean;
  source: 'firestore' | 'env' | 'default';
};

function parseBooleanString(value: string | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return null;
}

export function getBetaSignupsEnvValue(): boolean {
  const envValue =
    parseBooleanString(process.env.STUDYCUE_BETA_SIGNUPS_ENABLED) ??
    parseBooleanString(process.env.NEXT_PUBLIC_STUDYCUE_BETA_SIGNUPS_ENABLED) ??
    parseBooleanString(process.env.EXPO_PUBLIC_STUDYCUE_BETA_SIGNUPS_ENABLED);

  return envValue ?? DEFAULT_BETA_SIGNUPS_ENABLED;
}

export function isBetaSignupsEnabled() {
  return getBetaSignupsEnvValue();
}
