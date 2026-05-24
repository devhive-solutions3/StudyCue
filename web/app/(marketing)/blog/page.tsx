import type { Metadata } from 'next';

import GoogleAdSenseAd from '@/components/ads/GoogleAdSenseAd';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Blog',
  alternates: { canonical: canonical('/blog') },
};

export default function BlogIndexPage() {
  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Blog</p>
        <h1 className="font-serif text-4xl text-text-primary">Welcome to StudyCue</h1>
      </header>
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--sc-shadow-card)]">
        <p className="text-text-secondary">
          StudyCue is a smart study planner for students who want a calmer way to manage schoolwork. It brings your
          calendar, class schedules, tasks, notes, focus timer, and Cue AI into one clean workspace.
        </p>
        <p className="mt-4 text-text-secondary">
          Use StudyCue to plan your week, track what needs to be done, organize study materials, and stay focused
          during review sessions. This blog will share product updates, feature guides, and study tips to help you get
          the most out of StudyCue.
        </p>
      </div>
      <GoogleAdSenseAd className="mt-8" />
    </div>
  );
}
