import type { Metadata } from 'next';
import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Contact StudyCue Planner by Solutions DevHive for support, account questions, privacy requests, bug reports, feedback, or business inquiries.',
  alternates: { canonical: canonical('/contact') },
};

export default function ContactPage() {
  const email = 'support.studycue@gmail.com';
  const facebook = 'https://www.facebook.com/share/1apeFAUjcM/?mibextid=wwXIfr';
  const instagram = 'https://www.instagram.com/devhivesolutions?igsh=cjd3YzM1bWxyZnVz&utm_source=qr';
  const solutionsDevHive = 'https://www.solutionsdevhive.com/';
  const actionClassName =
    'inline-flex rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-2 hover:text-accent';

  return (
    <div className="mx-auto max-w-[900px] space-y-6">
      <header className="space-y-3">
        <h1 className="font-serif text-4xl text-text-primary">Contact StudyCue Planner</h1>
        <p className="max-w-2xl text-text-secondary">
          StudyCue Planner is built by Solutions DevHive. Reach out for account help, bug reports, privacy questions,
          product feedback, school workflow questions, or business inquiries related to StudyCue.
        </p>
      </header>

      <div className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)] sm:p-8">
        <h2 className="text-2xl font-semibold text-text-primary">Support email</h2>
        <p className="mt-3 max-w-2xl text-text-secondary">
          Email <a href={`mailto:${email}`} className="font-semibold text-accent underline underline-offset-4">{email}</a>. Include the page or feature involved, your device and browser, and the steps that led to the issue when reporting a bug.
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

      <section className="grid gap-5 md:grid-cols-2">
        {[
          ['Account and login help', 'Password reset problems, Google sign-in issues, profile access, or trouble reaching the planner after signup.'],
          ['Bug reports', 'Broken pages, sync issues, unexpected errors, mobile layout problems, or study tool output that does not load correctly.'],
          ['Privacy and legal questions', 'Questions about Terms, Privacy, Cookies, advertising disclosures, account data, or user choices.'],
          ['Product feedback', 'Suggestions from students, teachers, interns, or group project teams about how StudyCue can better support weekly planning.'],
        ].map(([title, body]) => (
          <article key={title} className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)]">
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{body}</p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)] sm:p-8">
        <h2 className="text-2xl font-semibold text-text-primary">Response expectation</h2>
        <p className="mt-3 max-w-3xl text-text-secondary">
          StudyCue is a small beta product, so response times can vary. We try to review support and privacy messages
          within 3-5 business days. Urgent account access or security-related reports should include “Urgent” in the
          email subject so they are easier to identify.
        </p>
        <p className="mt-4 text-sm text-text-muted">
          Business/company name: Solutions DevHive. Product: StudyCue Planner.
        </p>
      </section>
    </div>
  );
}
