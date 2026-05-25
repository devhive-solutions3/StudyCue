import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import AdSenseLoader from '@/components/AdSenseLoader';
import PrivacyAnalyticsScripts from '@/components/analytics/PrivacyAnalyticsScripts';
import MarketingShell from '@/components/layout/MarketingShell';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

/** Public marketing/content shell (analytics + marketing chrome). */
export default function MarketingSiteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AdSenseLoader />
      <PrivacyAnalyticsScripts />
      <MarketingShell>{children}</MarketingShell>
    </>
  );
}
