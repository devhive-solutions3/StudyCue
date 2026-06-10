import type { Metadata } from 'next';
import Link from 'next/link';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Cookies Policy',
  description: 'How StudyCue Planner uses essential, analytics, performance, advertising, and Google AdSense cookies.',
  alternates: { canonical: canonical('/cookies') },
};

const sections = [
  {
    title: 'What Cookies Are',
    body: [
      'Cookies are small files stored by your browser. Websites and apps also use similar technologies such as local storage, session storage, pixels, tags, and device identifiers.',
      'StudyCue Planner uses these technologies to keep the app working, remember choices, understand performance, and support advertising where applicable.',
    ],
  },
  {
    title: 'Essential Cookies',
    body: [
      'Essential cookies and storage help keep you signed in, protect your session, remember basic app preferences, route you through secure pages, and make core StudyCue Planner features work.',
      'Because these technologies are needed for the service, blocking them may prevent login, dashboard access, account sync, or security features from working correctly.',
    ],
  },
  {
    title: 'Analytics and Performance Cookies',
    body: [
      'Analytics and performance technologies help us understand aggregate usage, diagnose bugs, measure page performance, and improve StudyCue Planner. We use this information to make the product more reliable and useful.',
      'Where possible, analytics are kept privacy-safe and focused on product behavior rather than the personal content of your tasks, notes, schedules, or Cue prompts.',
    ],
  },
  {
    title: 'Advertising Cookies',
    body: [
      'Advertising cookies and similar technologies may be used to show, measure, and improve ads on StudyCue Planner, especially for Free plan experiences or public pages.',
      'Advertising partners may use cookies to personalize ads, limit repeated ads, detect invalid activity, and measure ad performance.',
    ],
  },
  {
    title: 'Google AdSense Cookies',
    body: [
      'StudyCue Planner may use Google AdSense. Third-party vendors, including Google, may use cookies to serve ads based on visits to StudyCue Planner and/or other websites.',
      'Google’s use of advertising cookies enables Google and its partners to serve ads based on visits to this site and other sites. You can learn more at Google’s partner sites policy.',
    ],
  },
  {
    title: 'Managing Cookie Preferences',
    body: [
      'Where StudyCue Planner shows a consent banner or preference control, you can use it to accept or reject optional advertising cookies. Essential cookies remain active because they are needed for authentication, security, and app operation.',
      'If you clear browser storage, use a new browser, or use a different device, you may need to set your preferences again.',
    ],
  },
  {
    title: 'Browser Controls',
    body: [
      'Most browsers let you block, delete, or limit cookies and local storage. Browser controls are usually available in privacy or site settings.',
      'Blocking all cookies may affect StudyCue Planner’s login, sync, preferences, and security features. For advertising choices, you can also review Google ad settings and browser-level privacy tools.',
    ],
  },
  {
    title: 'Contact Information',
    body: ['For cookie questions, contact support.studycue@gmail.com.'],
  },
];

export default function CookiesPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-text-muted">Legal</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-text-primary sm:text-5xl">
          Cookies Policy
        </h1>
        <p className="mt-4 text-base leading-7 text-text-secondary">
          Last updated: June 10, 2026
        </p>
        <p className="mt-4 text-base leading-8 text-text-secondary">
          This policy explains how StudyCue Planner uses cookies and similar technologies for app
          functionality, analytics, performance, and advertising.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.title} className="scroll-mt-24">
            <h2 className="font-serif text-2xl text-text-primary">{section.title}</h2>
            <div className="mt-4 space-y-4 text-base leading-8 text-text-secondary">
              {section.body.map((paragraph) =>
                paragraph.includes('Google’s partner sites policy') ? (
                  <p key={paragraph}>
                    Google’s use of advertising cookies enables Google and its partners to serve ads
                    based on visits to this site and other sites. You can learn more at{' '}
                    <a
                      href="https://policies.google.com/technologies/partner-sites"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-accent underline underline-offset-4"
                    >
                      Google’s partner sites policy
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
        This Cookies Policy works together with the{' '}
        <Link href="/privacy" className="font-semibold text-accent underline underline-offset-4">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/terms" className="font-semibold text-accent underline underline-offset-4">
          Terms of Use
        </Link>
        .
      </footer>
    </article>
  );
}
