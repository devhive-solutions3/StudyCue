import type { Metadata } from 'next';
import Link from 'next/link';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  alternates: { canonical: canonical('/help') },
};

export default function HelpPage() {
  return (
    <article className="space-y-6 text-text-primary">
      <header>
        <h1 className="font-serif text-4xl">Help desk</h1>
        <p className="text-text-secondary">StudyCue support and guides are coming soon.</p>
      </header>
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--shadow-sm)]">
        <p className="text-text-secondary">
          We are preparing helpful guides for using StudyCue, including calendar setup, task planning, notes, focus
          timer, and Cue AI. For direct questions, please visit the Contact page.
        </p>
        <div className="mt-4">
          <Link
            href="/contact"
            className="inline-flex rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-accent"
          >
            Contact us
          </Link>
        </div>
      </div>
    </article>
  );
}
