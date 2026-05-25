const DEFAULT_BETA_SIGNUPS_ENABLED = true;

export function isBetaSignupsEnabled() {
  return (
    process.env.STUDYCUE_BETA_SIGNUPS_ENABLED ??
    process.env.NEXT_PUBLIC_STUDYCUE_BETA_SIGNUPS_ENABLED ??
    process.env.EXPO_PUBLIC_STUDYCUE_BETA_SIGNUPS_ENABLED ??
    String(DEFAULT_BETA_SIGNUPS_ENABLED)
  ) === 'true';
}
