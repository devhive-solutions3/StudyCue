import type { Metadata } from 'next';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact',
  alternates: { canonical: canonical('/contact') },
};

export default function ContactPage() {
  const email = 'solutions.devhive@gmail.com';
  const facebook = 'https://www.facebook.com/share/1apeFAUjcM/?mibextid=wwXIfr';
  const instagram = 'https://www.instagram.com/devhivesolutions?igsh=cjd3YzM1bWxyZnVz&utm_source=qr';
  const solutionsDevHive = 'https://www.solutionsdevhive.com/';
  const actionClassName =
    'inline-flex rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-accent';

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl text-text-primary">Contact StudyCue</h1>
        <p className="max-w-2xl text-text-secondary">
          Reach out to the Solutions DevHive team for questions, support, or project inquiries.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <p className="max-w-2xl text-text-secondary">
          Need help with StudyCue or want to connect with the team? Use the links below to reach us through email or
          our social channels.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={`mailto:${email}`} className={actionClassName}>
            Send email
          </a>
          <a href={facebook} target="_blank" rel="noreferrer" className={actionClassName}>
            Visit Facebook
          </a>
          <a href={instagram} target="_blank" rel="noreferrer" className={actionClassName}>
            Visit Instagram
          </a>
          <a href={solutionsDevHive} target="_blank" rel="noreferrer" className={actionClassName}>
            Visit Solutions DevHive
          </a>
        </div>
      </div>
    </div>
  );
}
