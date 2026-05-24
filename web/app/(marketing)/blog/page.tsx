import type { Metadata } from 'next';

import GoogleAdSenseAd from '@/components/ads/GoogleAdSenseAd';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Read study planning guides, product explainers, and student workflow tips from StudyCue Planner.',
  alternates: { canonical: canonical('/blog') },
};

export default function BlogIndexPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Blog</p>
        <h1 className="font-serif text-4xl text-text-primary">StudyCue Planner blog</h1>
      </header>
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
        <p className="text-text-secondary">
          StudyCue Planner is a smart study planner for students who want a calmer way to manage schoolwork. It brings
          your calendar, class schedules, tasks, notes, focus timer, and Cue AI into one clean workspace.
        </p>
        <p className="mt-4 text-text-secondary">
          Use StudyCue Planner to plan your week, track what needs to be done, organize study materials, and stay
          focused during review sessions. This blog collects product updates, feature guides, and practical study tips
          so students can get more value from the planner over time.
        </p>
      </div>
      <section className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
        <h2 className="text-2xl font-semibold text-text-primary">What you can read here</h2>
        <p className="mt-3 text-text-secondary">
          Expect posts about active recall, time blocking, class schedule planning, exam preparation, focus habits, and
          how to use StudyCue Planner for day-to-day schoolwork.
        </p>
      </section>
      <GoogleAdSenseAd className="mt-8" />
    </div>
  );
}
