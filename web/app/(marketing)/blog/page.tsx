import type { Metadata } from 'next';

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
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--shadow-sm)]">
        <p className="text-text-secondary">
          Welcome sa lahat ng new users at old users ng StudyCue. More blog updates coming soon.
        </p>
      </div>
    </div>
  );
}
