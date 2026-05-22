import type { Metadata } from 'next';
import Link from 'next/link';

import AdSenseSlot from '@/components/ads/AdSenseSlot';
import JsonLd from '@/components/seo/JsonLd';
import { canonical, siteTitle } from '@/lib/site-config';

export const metadata: Metadata = {
  title: siteTitle,
  description:
    'StudyCue is a local-first planner for students — calendars, Pomodoro, and focused study workflows across mobile and web.',
  alternates: { canonical: canonical('/') },
  openGraph: {
    title: siteTitle,
    description: 'Plan classes, grind focus sessions, sync across mobile and web.',
    url: canonical('/'),
    siteName: 'StudyCue',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: 'Plan classes, grind focus sessions, sync across mobile and web.',
  },
};

export default function LandingPage() {
  const organization = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'StudyCue',
    url: canonical('/'),
    sameAs: [] as string[],
  };

  return (
    <>
      <JsonLd data={organization} />
      <section className="space-y-6 text-center">
        <p className="mx-auto inline-flex rounded-full border border-border bg-surface px-4 py-1 text-[11px] font-medium uppercase tracking-widest text-accent">
          Web cockpit · Mobile and desktop · Ads only on marketing
        </p>
        <h1 className="text-balance font-serif text-4xl tracking-tight text-text-primary sm:text-6xl md:text-[3.65rem]">
          The study planner built for ADHD brains and packed semesters.
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-text-secondary">
          Keep everything on-device in the Expo app — then open the mirrored web dashboard when you&apos;re deep in
          browser land. StudyCue helps you stay organized without adding extra complexity.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-accent px-7 py-3 text-base font-semibold text-white shadow-[var(--shadow-accent)] hover:bg-accent-hover"
          >
            Create web account
          </Link>
          <Link href="/features" className="rounded-xl border border-border px-7 py-3 text-text-secondary hover:bg-surface-2">
            See features
          </Link>
        </div>
      </section>

      <AdSenseSlot compact className="mt-10 max-w-xl" />

      <section id="tiles" className="mt-20 grid gap-6 md:grid-cols-3">
        <FeatureCard title="Mobile planning" detail="Manage classes, tasks, and study sessions quickly from your phone." />
        <FeatureCard title="Desktop dashboard" detail="Use a wider layout on web for cleaner planning and weekly review." />
        <FeatureCard title="Focus sessions" detail="Run focused study timers and track consistency over time." />
      </section>

      <section className="mt-20 rounded-3xl border border-border bg-surface p-8 shadow-[var(--shadow-sm)]">
        <h2 className="text-2xl font-semibold text-text-primary">Screens you will actually ship</h2>
        <p className="mt-3 max-w-prose text-text-secondary">
          StudyCue gives students a simple flow: capture tasks on mobile, then review and organize better on desktop.
          The same account works across both so old and new users can continue where they left off.
        </p>
      </section>
    </>
  );
}

function FeatureCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 text-left shadow-[var(--shadow-sm)]">
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}
