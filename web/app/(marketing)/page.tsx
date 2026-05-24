import type { Metadata } from 'next';
import Link from 'next/link';

import GoogleAdSenseAd from '@/components/ads/GoogleAdSenseAd';
import JsonLd from '@/components/seo/JsonLd';
import { resolveSiteOrigin } from '@/lib/site-config';

const HOME_URL = `${resolveSiteOrigin()}/`;
const HOME_TITLE = 'StudyCue - Smart Study Planner and Focus Timer';
const HOME_DESCRIPTION =
  'StudyCue is a smart study planner for managing classes, tasks, focus sessions, notes, and schedules in one calm student workspace.';

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: HOME_URL },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: HOME_URL,
    siteName: 'StudyCue',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
};

export default function LandingPage() {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'StudyCue',
    alternateName: ['Study Cue', 'StudyCue by Solutions DevHive'],
    url: HOME_URL,
  };

  const softwareApplication = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'StudyCue',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: HOME_URL,
  };

  return (
    <>
      <JsonLd data={[website, softwareApplication]} />
      <section className="space-y-6 text-center">
        <p className="mx-auto inline-flex rounded-full border border-border bg-surface px-4 py-1 text-[11px] font-medium uppercase tracking-widest text-accent">
          StudyCue by Solutions DevHive · Smart study planner · Mobile and desktop
        </p>
        <h1 className="text-balance font-serif text-4xl tracking-tight text-text-primary sm:text-6xl md:text-[3.65rem]">
          StudyCue is the smart study planner built for calm, organized student workdays.
        </h1>
        <p className="mx-auto max-w-2xl text-lg text-text-secondary">
          StudyCue brings your calendar, tasks, focus timer, notes, schedules, and Cue AI into one calm student
          workspace. Built by Solutions DevHive, it helps you plan classes, protect focus sessions, and keep your
          weekly study flow clear on web.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-accent px-7 py-3 text-base font-semibold text-white shadow-[var(--sc-shadow-accent)] hover:bg-accent-hover"
          >
            Create web account
          </Link>
          <Link href="/features" className="rounded-xl border border-border px-7 py-3 text-text-secondary hover:bg-surface-2">
            See features
          </Link>
        </div>
      </section>

      <section id="tiles" className="mt-20 grid gap-6 md:grid-cols-3">
        <FeatureCard title="Calendar and schedules" detail="Manage class blocks, study schedules, and weekly planning in a student-friendly calendar." />
        <FeatureCard title="Tasks, notes, and Cue AI" detail="Capture tasks, write notes, and use Cue AI to sort the next best step in your study plan." />
        <FeatureCard title="Focus timer" detail="Run focused study sessions with a calm timer flow that fits into the rest of your workspace." />
      </section>

      <GoogleAdSenseAd className="mt-12" />

      <section className="mt-20 rounded-3xl border border-border bg-surface p-8 shadow-[var(--sc-shadow-card)]">
        <h2 className="text-2xl font-semibold text-text-primary">Built for calmer study planning</h2>
        <p className="mt-3 max-w-prose text-text-secondary">
          StudyCue gives students one clean place to plan class schedules, manage tasks, organize notes, run focus
          sessions, and get help from Cue AI.
        </p>
      </section>
    </>
  );
}

function FeatureCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-3xl border border-border bg-surface p-6 text-left shadow-[var(--sc-shadow-card)]">
      <p className="text-lg font-semibold text-text-primary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{detail}</p>
    </div>
  );
}
