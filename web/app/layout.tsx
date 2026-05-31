import type { Metadata } from 'next';

import { Providers } from '@/components/Providers';

import './globals.css';
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
  alternates: { canonical: PRODUCTION_CANONICAL_ORIGIN },
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-full antialiased">
      <head>
        <script
          id="studycue-adsense-script"
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9703603099562509"
          crossOrigin="anonymous"
        />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
