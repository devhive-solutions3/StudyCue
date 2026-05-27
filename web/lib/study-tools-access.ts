import 'server-only';

import { getUserPlanByUid, getUserProfileByUid } from '@/lib/server-user-plan';
import { canUsePremiumStudyTools } from '@/lib/plan-access';

export async function assertPremiumStudyToolsAccess(uid: string): Promise<{
  allowed: boolean;
  status: 403 | 401;
  message?: string;
}> {
  const profile = await getUserProfileByUid(uid);
  if (!canUsePremiumStudyTools(profile)) {
    const plan = await getUserPlanByUid(uid);
    return {
      allowed: false,
      status: 403,
      message:
        plan === 'free'
          ? 'This feature is available for Beta and StudyCue Plus users.'
          : 'This study tool is not available on your current plan.',
    };
  }
  return { allowed: true, status: 403 };
}
