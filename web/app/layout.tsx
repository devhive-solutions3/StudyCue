import type { Metadata } from 'next';
import Script from 'next/script';

import { Providers } from '@/components/Providers';

import './globals.css';
import { getAdsenseClient } from '@/lib/adsense-config';
import {
  openGraphDescription,
  PRODUCTION_CANONICAL_ORIGIN,
  siteDescription,
  siteKeywords,
  siteName,
  siteTitle,
} from '@/lib/seo-config';
import { resolveSiteOrigin } from '@/lib/site-config';

export const metadata: Metadata = {
  metadataBase: new URL(resolveSiteOrigin()),
  title: { default: siteTitle, template: `%s · ${siteName}` },
  description: siteDescription,
  keywords: [...siteKeywords],
  robots: { index: true, follow: true },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/cue-icon.png', type: 'image/png' },
    ],
    apple: [{ url: '/cue-icon.png', type: 'image/png' }],
  },
  openGraph: {
    title: siteTitle,
    description: openGraphDescription,
    url: PRODUCTION_CANONICAL_ORIGIN,
    siteName,
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: openGraphDescription,
  },
};

const themeBootScript = `
  try {
    var key = 'studycue.theme';
    var stored = window.localStorage.getItem(key);
    var theme = stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
    var dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsenseClient = getAdsenseClient();

  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-bg text-text-primary">
        {/* Next injects beforeInteractive scripts into <head>; keep it here to avoid head hydration drift. */}
        <Script
          id="adsense-verification"
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsenseClient)}`}
          crossOrigin="anonymous"
          strategy="beforeInteractive"
        />
        <Script id="studycue-theme-boot" strategy="beforeInteractive">
          {themeBootScript}
        </Script>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
