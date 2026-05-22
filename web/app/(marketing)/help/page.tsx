import type { Metadata } from 'next';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Help & FAQ',
  alternates: { canonical: canonical('/help') },
};

export default function HelpPage() {
  const email = 'solutions.devhive@gmail.com';
  const messenger = 'https://www.facebook.com/share/1apeFAUjcM/?mibextid=wwXIfr';

  return (
    <article className="space-y-6 text-text-primary">
      <header>
        <h1 className="font-serif text-4xl">Help desk</h1>
        <p className="text-text-secondary">Coming soon.</p>
      </header>
      <div className="rounded-2xl border border-border bg-surface px-5 py-6 shadow-[var(--shadow-sm)]">
        <p className="text-text-secondary">We are preparing the help center for now. Please check back soon.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href={`mailto:${email}`} className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-accent">
            Send email
          </a>
          <a
            href={messenger}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-accent"
          >
            Open Messenger
          </a>
        </div>
      </div>
    </article>
  );
}
