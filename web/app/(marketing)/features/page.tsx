import type { Metadata } from 'next';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Features',
  description: 'Simple features for StudyCue mobile and web app.',
  alternates: { canonical: canonical('/features') },
  openGraph: { title: 'StudyCue Features', url: canonical('/features') },
};

export default function FeaturesPage() {
  const blocks = [
    [
      'Mobile app planner',
      'Manage classes, tasks, and study sessions from your phone with a simple daily workflow.',
    ],
    [
      'Mobile quick capture',
      'Add tasks fast during class breaks and keep your day organized in one place.',
    ],
    [
      'Web dashboard',
      'Open StudyCue on desktop for a wider layout so planning and review feel easier.',
    ],
    [
      'Cross-device access',
      'Use the same account on mobile and web so old and new users can continue where they left off.',
    ],
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Product</p>
        <h1 className="font-serif text-4xl text-text-primary">What ships today</h1>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {blocks.map(([title, body]) => (
          <article key={title} className="rounded-3xl border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="mt-3 text-text-secondary">{body}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
