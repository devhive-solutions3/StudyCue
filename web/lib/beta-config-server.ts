import 'server-only';

import type { BetaSignupMode } from '@/lib/beta-config';
import { getBetaSignupsEnvValue } from '@/lib/beta-config';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';

export async function getBetaSignupsMode(): Promise<BetaSignupMode> {
  if (readFirebaseAdminStatus().configured) {
    try {
      const snapshot = await getFirebaseAdminDb().doc('adminSettings/appConfig').get();
      const value = snapshot.data()?.betaSignupsEnabled;
      if (typeof value === 'boolean') {
        return { enabled: value, source: 'firestore' };
      }
    } catch {
      /* fallback to env/default */
    }
  }

  if (
    process.env.STUDYCUE_BETA_SIGNUPS_ENABLED != null ||
    process.env.NEXT_PUBLIC_STUDYCUE_BETA_SIGNUPS_ENABLED != null ||
    process.env.EXPO_PUBLIC_STUDYCUE_BETA_SIGNUPS_ENABLED != null
  ) {
    return { enabled: getBetaSignupsEnvValue(), source: 'env' };
  }

  return { enabled: getBetaSignupsEnvValue(), source: 'default' };
}

export async function getBetaSignupsEnabled(): Promise<boolean> {
  const mode = await getBetaSignupsMode();
  return mode.enabled;
}
