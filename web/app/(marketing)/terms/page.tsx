import type { Metadata } from 'next';
import Link from 'next/link';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The Terms of Use for StudyCue Planner accounts, beta access, Cue AI, ads, and student responsibilities.',
  alternates: { canonical: canonical('/terms') },
};

function sectionId(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const sections = [
  {
    title: 'Acceptance of Terms',
    body: [
      'By creating an account, accessing, or using StudyCue Planner, you agree to these Terms of Use, our Privacy Policy, and our Cookies Policy. If you do not agree, please do not create an account or use the service.',
      'These Terms are written as a clear, user-facing baseline for StudyCue Planner during beta launch. They are not legal advice, and they may be updated as the product, policies, and legal requirements evolve.',
    ],
  },
  {
    title: 'About StudyCue Planner',
    body: [
      'StudyCue Planner is a study planning workspace that helps students organize schedules, tasks, notes, focus sessions, flashcards, quizzes, and Cue AI-assisted study planning. The product is designed to support organization, practice, and learning habits.',
      'StudyCue Planner is not a school, tutoring replacement, emergency service, academic adviser, or professional adviser. You are responsible for checking important dates, assignments, requirements, and outputs before relying on them.',
    ],
  },
  {
    title: 'Beta Service',
    body: [
      'StudyCue Planner may currently be offered in active beta. Beta features may change, break, be limited, or be removed. We may update limits, availability, pricing, plans, storage, AI usage, advertisements, and features as the product improves.',
      'We try to keep the service useful and stable, but beta access is provided as-is and may include bugs, incomplete features, or temporary interruptions.',
    ],
  },
  {
    title: 'Account Registration',
    body: [
      'You may need an account to use StudyCue Planner. You are responsible for providing accurate account information, keeping your sign-in method secure, and protecting access to your device and account.',
      'You are responsible for activity that occurs under your account. If you believe your account has been accessed without permission, contact us as soon as possible.',
    ],
  },
  {
    title: 'User Responsibilities',
    body: [
      'You are responsible for the tasks, schedules, notes, files, prompts, study materials, and other content you add to StudyCue Planner. Do not upload or enter content that you do not have permission to use.',
      'You should keep your own backup of important academic information. StudyCue Planner is a planning aid and should not be the only place where you store critical deadlines or study materials.',
    ],
  },
  {
    title: 'Student Use and Academic Integrity',
    body: [
      'StudyCue tools are intended to support learning, organization, review, and study planning. You must follow your school, teacher, university, testing program, or institution rules when using StudyCue Planner.',
      'Do not use StudyCue Planner or Cue AI to cheat, bypass academic rules, submit AI-generated work as your own where prohibited, complete graded work dishonestly, or violate school policies.',
    ],
  },
  {
    title: 'StudyCue AI and Cue Assistant Limitations',
    body: [
      'Cue AI may help summarize, plan, explain, brainstorm, generate practice materials, or organize study work. AI outputs can be incomplete, outdated, incorrect, or unsuitable for your situation.',
      'You are responsible for reviewing and verifying Cue AI outputs before using them. Cue AI should not be treated as a guaranteed source of truth, professional advice, or permission to ignore academic integrity rules.',
    ],
  },
  {
    title: 'Free Plan and Advertisements',
    body: [
      'StudyCue may offer free access during beta or as part of an ongoing Free plan. The Free plan may include advertisements or sponsored placements.',
      'Ads may be delivered by third-party advertising partners such as Google AdSense. Advertising partners may use cookies or similar technologies as described in our Privacy Policy and Cookies Policy.',
    ],
  },
  {
    title: 'Paid Plans and Plus Beta Access',
    body: [
      'StudyCue may offer paid plans, beta access, promotional access, or StudyCue Plus features. Plan names, prices, benefits, storage limits, usage limits, and availability may change over time.',
      'If paid plans are offered, billing terms shown at checkout or in plan materials will apply. Beta access does not guarantee that the same features, limits, or pricing will remain available later.',
    ],
  },
  {
    title: 'User Content and Planner Data',
    body: [
      'Users may add tasks, schedules, notes, study materials, flashcards, quizzes, focus sessions, and other planner information. You keep responsibility for the content you add.',
      'You give StudyCue permission to store, process, transmit, and display your content as needed to provide the service, sync your account, secure the platform, troubleshoot issues, and improve StudyCue Planner.',
    ],
  },
  {
    title: 'Prohibited Behavior',
    body: [
      'Do not abuse the service, spam, harass others, upload harmful content, attempt unauthorized access, interfere with platform security, reverse engineer protected systems, overload the service, or use StudyCue for unlawful or harmful activity.',
      'Do not attempt to bypass usage limits, plan restrictions, storage limits, security controls, authentication, ad controls, or beta access controls.',
    ],
  },
  {
    title: 'Service Availability',
    body: [
      'We try to keep StudyCue Planner available, but we do not guarantee uninterrupted access, error-free operation, permanent availability of any feature, or that all data will always sync immediately.',
      'Maintenance, outages, third-party provider issues, security updates, or beta changes may affect access.',
    ],
  },
  {
    title: 'Suspension or Termination',
    body: [
      'We may suspend, restrict, or terminate accounts that violate these Terms, abuse the service, create security risk, misuse Cue AI, infringe rights, or harm StudyCue Planner or other users.',
      'We may also limit access to beta features, AI tools, storage, or specific workflows when needed for safety, stability, legal compliance, or abuse prevention.',
    ],
  },
  {
    title: 'Changes to the Service',
    body: [
      'StudyCue Planner will continue to evolve. We may add, change, limit, rename, or remove features, plans, pricing, ads, integrations, AI models, storage options, and supported platforms.',
      'We may update these Terms from time to time. Continued use after updates means you accept the updated Terms.',
    ],
  },
  {
    title: 'Limitation of Liability',
    body: [
      'To the fullest extent allowed by law, StudyCue Planner is provided without warranties of any kind. We are not responsible for indirect, incidental, special, consequential, or punitive damages, or for lost data, lost profits, academic outcomes, missed deadlines, or reliance on AI outputs.',
      'Nothing in these Terms limits liability where the law does not allow it. Some rights may vary depending on your location.',
    ],
  },
  {
    title: 'Contact Information',
    body: [
      'For questions about these Terms, contact support.studycue@gmail.com.',
    ],
  },
];

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl">
      <header className="border-b border-border pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-text-muted">Legal</p>
        <h1 className="mt-3 font-serif text-4xl leading-tight text-text-primary sm:text-5xl">
          Terms of Use
        </h1>
        <p className="mt-4 text-base leading-7 text-text-secondary">
          Last updated: June 10, 2026
        </p>
        <p className="mt-4 text-base leading-8 text-text-secondary">
          These Terms explain the baseline rules for using StudyCue Planner during beta. They are
          designed to be understandable for students and families while keeping the service safe,
          useful, and transparent.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.title} id={sectionId(section.title)} className="scroll-mt-24">
            <h2 className="font-serif text-2xl text-text-primary">{section.title}</h2>
            <div className="mt-4 space-y-4 text-base leading-8 text-text-secondary">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 rounded-[20px] border border-border bg-surface px-5 py-5 text-sm leading-7 text-text-secondary">
        Please also review the{' '}
        <Link href="/privacy" className="font-semibold text-accent underline underline-offset-4">
          Privacy Policy
        </Link>{' '}
        and{' '}
        <Link href="/cookies" className="font-semibold text-accent underline underline-offset-4">
          Cookies Policy
        </Link>
        .
      </footer>
    </article>
  );
}
