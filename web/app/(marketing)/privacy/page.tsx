import type { Metadata } from 'next';
import Link from 'next/link';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How StudyCue Planner collects, uses, stores, shares, and protects account, planner, analytics, cookies, and advertising data.',
  alternates: { canonical: canonical('/privacy') },
};

const sections = [
  {
    title: 'Information We Collect',
    body: [
      'We collect information needed to create accounts, provide StudyCue Planner, sync your planner, secure the service, understand product usage, and support advertising where applicable.',
      'The exact information collected depends on how you use StudyCue Planner, which sign-in method you choose, and which features you use.',
    ],
  },
  {
    title: 'Account Information',
    body: [
      'When you create or use an account, we may process your email address, display name, profile photo, sign-in provider, account identifiers, plan, beta access status, storage limits, usage limits, and account timestamps.',
      'Authentication may be handled through Firebase and supported sign-in providers such as email/password or Google sign-in.',
    ],
  },
  {
    title: 'Planner, Task, and Note Data',
    body: [
      'StudyCue Planner may store schedules, classes, tasks, deadlines, notes, folders, files, focus sessions, study outputs, flashcards, quizzes, Cue AI interactions, and related planner information you choose to add.',
      'You should avoid storing highly sensitive personal information in planner entries or notes unless it is necessary for your own use.',
    ],
  },
  {
    title: 'Usage and Analytics Data',
    body: [
      'We may collect privacy-safe product analytics such as feature usage, page or route usage, plan type, event counts, AI usage estimates, error information, and device or browser information used for troubleshooting.',
      'Analytics help us improve StudyCue Planner, understand what features are useful, detect abuse, manage limits, and fix bugs. We aim to avoid storing task titles, note content, Cue prompts, calendar details, or file names in product analytics events.',
    ],
  },
  {
    title: 'Cookies and Similar Technologies',
    body: [
      'We use cookies, local storage, and similar technologies to keep you signed in, remember preferences, manage consent, protect the service, measure performance, and support advertising where allowed.',
      'You can learn more about cookie categories and browser controls in our Cookies Policy.',
    ],
  },
  {
    title: 'Advertising and Google AdSense',
    body: [
      'StudyCue Planner may display ads through Google AdSense or other advertising partners, especially on Free plan or public content experiences.',
      'Third-party vendors, including Google, may use cookies or similar technologies to serve ads based on a user’s visits to StudyCue Planner and/or other websites. Google’s use of advertising cookies enables Google and its partners to serve ads based on visits to this site and other sites.',
      'Users can learn more about how Google uses data when using partner sites or apps at https://policies.google.com/technologies/partner-sites.',
    ],
  },
  {
    title: 'How Information Is Used',
    body: [
      'We use information to provide and operate StudyCue Planner, create and secure accounts, sync data, personalize the workspace, provide Cue AI and study tools, enforce limits, process beta or plan access, respond to support requests, and improve reliability.',
      'We may also use information to detect abuse, prevent fraud, troubleshoot issues, comply with legal obligations, and show or manage advertising where applicable.',
    ],
  },
  {
    title: 'How Information Is Shared',
    body: [
      'We do not sell your planner entries, notes, or tasks. We may share information with service providers that help operate StudyCue Planner, such as authentication, hosting, database, analytics, AI, storage, security, and advertising providers.',
      'We may disclose information if required by law, to protect rights and safety, to investigate abuse, or as part of a business transfer such as a merger, acquisition, or reorganization.',
    ],
  },
  {
    title: 'Data Storage and Security',
    body: [
      'We use technical and organizational measures designed to protect account and planner data, including account-based access controls and secure service providers. No online service can guarantee perfect security.',
      'You are responsible for keeping your password, Google account, device, and browser session secure.',
    ],
  },
  {
    title: 'User Choices',
    body: [
      'You may update certain account information in the app, manage browser cookies, clear local storage, choose whether to accept optional advertising cookies where consent controls are shown, and contact us about privacy questions.',
      'Some cookies and storage are essential for authentication, security, and app functionality. Blocking them may prevent StudyCue Planner from working correctly.',
    ],
  },
  {
    title: 'Children and Minors',
    body: [
      'StudyCue Planner is intended for students who can use the service with appropriate permission where required. If you are under the age required by your location to use online services on your own, use StudyCue Planner only with parent, guardian, or school permission.',
      'Parents or guardians who believe a child provided personal information without appropriate permission can contact us.',
    ],
  },
  {
    title: 'Changes to This Privacy Policy',
    body: [
      'We may update this Privacy Policy as StudyCue Planner changes, as advertising or analytics practices change, or as legal requirements evolve. The updated version will show a new last updated date.',
      'Continued use of StudyCue Planner after an update means the updated policy applies to your use going forward.',
    ],
  },
  {
    title: 'Contact Information',
    body: ['For privacy questions, contact hello@studycueplanner.com.'],
  },
];

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-text-muted">Legal</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-text-primary sm:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-4 text-base leading-7 text-text-secondary">
          Last updated: June 1, 2026
        </p>
        <p className="mt-4 text-base leading-8 text-text-secondary">
          This policy explains what StudyCue Planner collects, how it is used, and the choices you
          have. We aim to keep the language clear so students and families can understand it.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.title} className="scroll-mt-24">
            <h2 className="font-serif text-2xl text-text-primary">{section.title}</h2>
            <div className="mt-4 space-y-4 text-base leading-8 text-text-secondary">
              {section.body.map((paragraph) =>
                paragraph.includes('https://policies.google.com/technologies/partner-sites') ? (
                  <p key={paragraph}>
                    Users can learn more about how Google uses data when using partner sites or apps at{' '}
                    <a
                      href="https://policies.google.com/technologies/partner-sites"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-accent underline underline-offset-4"
                    >
                      Google&apos;s partner sites policy
                    </a>
                    .
                  </p>
                ) : (
                  <p key={paragraph}>{paragraph}</p>
                ),
              )}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 rounded-[20px] border border-border bg-surface px-5 py-5 text-sm leading-7 text-text-secondary">
        For cookie categories and browser controls, review the{' '}
        <Link href="/cookies" className="font-semibold text-accent underline underline-offset-4">
          Cookies Policy
        </Link>
        .
      </footer>
    </article>
  );
}
