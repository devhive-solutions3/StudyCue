import 'server-only';

import { readFirebaseAdminStatus, getFirebaseAdminDb } from '@/lib/firebase-admin';
import { getPlanConfigForProfile, getUserPlan } from '@/lib/plan-access';
import type { UserPlan, UserPlanConfig } from '@/lib/user-plan';

type ServerUserProfile = Record<string, unknown> | null;

const IS_DEV = process.env.NODE_ENV !== 'production';

export async function getUserProfileByUid(uid: string): Promise<ServerUserProfile> {
  const normalizedUid = uid.trim();
  if (!normalizedUid) return null;

  if (!readFirebaseAdminStatus().configured) {
    if (IS_DEV) {
      console.warn('[server-user-plan] firebase admin not configured; defaulting to free plan');
    }
    return null;
  }

  try {
    const snapshot = await getFirebaseAdminDb().doc(`users/${normalizedUid}`).get();
    if (!snapshot.exists) return null;
    return (snapshot.data() as Record<string, unknown>) ?? null;
  } catch (error) {
    if (IS_DEV) {
      console.warn('[server-user-plan] failed to read profile', {
        uid: normalizedUid,
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return null;
  }
}

export async function getUserPlanByUid(uid: string): Promise<UserPlan> {
  const profile = await getUserProfileByUid(uid);
  return getUserPlan(profile);
}

export async function getPlanLimitsByUid(uid: string): Promise<UserPlanConfig> {
  const profile = await getUserProfileByUid(uid);
  return getPlanConfigForProfile(profile);
}
