import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Script from 'next/script';

import PrivacyAnalyticsScripts from '@/components/analytics/PrivacyAnalyticsScripts';
import MarketingShell from '@/components/layout/MarketingShell';
import { getAdsenseClient } from '@/lib/adsense-config';

export const metadata: Metadata = {
  robots: { index: true, follow: true },
};

/** Public marketing/content shell (AdSense verification script + analytics). */
export default function MarketingSiteLayout({ children }: { children: ReactNode }) {
  const client = getAdsenseClient();

  return (
    <>
      {/* AdSense site verification: must be present in page HTML for Google crawler (marketing pages only). */}
      <Script
        id="adsense-loader"
        async
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`}
        crossOrigin="anonymous"
        strategy="beforeInteractive"
      />
      <PrivacyAnalyticsScripts />
      <MarketingShell>{children}</MarketingShell>
    </>
  );
}
