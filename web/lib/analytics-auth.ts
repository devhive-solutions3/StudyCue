import 'server-only';

import { trackServerAnalyticsEvent, planFromProfile } from '@/lib/analytics-tracker';

export async function trackProfileSignupAnalytics(params: {
  uid: string;
  profile: Record<string, unknown>;
  signupSource?: 'email' | 'google' | null;
}) {
  const userPlan = planFromProfile(params.profile);
  await trackServerAnalyticsEvent({
    uid: params.uid,
    userPlan,
    eventType: 'signup',
    feature: 'dashboard',
    route: '/app',
    metadata: params.signupSource ? { source: params.signupSource } : {},
    recordLogin: true,
    incrementPageView: false,
  });
}

export async function trackProfileLoginAnalytics(params: {
  uid: string;
  profile: Record<string, unknown>;
}) {
  const userPlan = planFromProfile(params.profile);
  await trackServerAnalyticsEvent({
    uid: params.uid,
    userPlan,
    eventType: 'login',
    feature: 'dashboard',
    route: '/app',
    metadata: {},
    recordLogin: true,
    incrementPageView: false,
  });
}
