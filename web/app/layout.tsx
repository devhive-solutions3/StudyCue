import type { Metadata } from 'next';
import { DM_Sans, DM_Serif_Display } from 'next/font/google';

import { Providers } from '@/components/Providers';

import './globals.css';
import { getSiteUrl, siteTitle } from '@/lib/site-config';

const dmSans = DM_Sans({
  variable: '--font-dm-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const dmSerif = DM_Serif_Display({
  variable: '--font-dm-serif',
  subsets: ['latin'],
  weight: ['400'],
  display: 'swap',
});

const base = getSiteUrl() || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: siteTitle, template: '%s · StudyCue' },
  description:
    'Local-first college planner with Pomodoro, calendar, and focused study workflows across mobile and web.',
  robots: { index: true, follow: true },
  icons: [
    { rel: 'icon', url: '/favicon.ico' },
    { rel: 'icon', type: 'image/png', url: '/cue-icon-light.png' },
    { rel: 'apple-touch-icon', url: '/cue-icon-light.png' },
  ],
  openGraph: {
    title: siteTitle,
    description: 'Plan classes and focus sessions. StudyCue syncs securely between mobile and browser.',
    type: 'website',
    locale: 'en_US',
    siteName: 'StudyCue',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-text-primary">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
