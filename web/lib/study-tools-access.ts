import 'server-only';

import { getUserPlanByUid, getUserProfileByUid } from '@/lib/server-user-plan';
import { canUseStudyToolsAi } from '@/lib/plan-access';
import { STUDY_TOOLS_PLAN_DENIED_MESSAGE } from '@/lib/study-tools-request';

export { STUDY_TOOLS_PLAN_DENIED_MESSAGE };

export async function assertPremiumStudyToolsAccess(uid: string): Promise<{
  allowed: boolean;
  status: 403 | 401;
  message?: string;
  plan?: Awaited<ReturnType<typeof getUserPlanByUid>>;
}> {
  const [profile, plan] = await Promise.all([
    getUserProfileByUid(uid),
    getUserPlanByUid(uid),
  ]);

  if (!canUseStudyToolsAi(profile)) {
    return {
      allowed: false,
      status: 403,
      message: STUDY_TOOLS_PLAN_DENIED_MESSAGE,
      plan,
    };
  }
  return { allowed: true, status: 403, plan };
}
