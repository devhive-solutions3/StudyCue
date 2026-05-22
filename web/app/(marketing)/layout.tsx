import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import GoogleAdLoader from '@/components/ads/GoogleAdLoader';
import PrivacyAnalyticsScripts from '@/components/analytics/PrivacyAnalyticsScripts';
import MarketingShell from '@/components/layout/MarketingShell';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

/** Public marketing/content shell (ads + lightweight analytics scripts). */
export default function MarketingSiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PrivacyAnalyticsScripts />
      <GoogleAdLoader />
      <MarketingShell>{children}</MarketingShell>
    </>
  );
}
