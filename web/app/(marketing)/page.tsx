import type { Metadata } from 'next';
import Link from 'next/link';

import JsonLd from '@/components/seo/JsonLd';
import {
  openGraphDescription,
  organizationName,
  PRODUCTION_CANONICAL_ORIGIN,
  siteKeywords,
  siteName,
  siteTitle,
  structuredDataDescription,
} from '@/lib/seo-config';
import { canonical } from '@/lib/site-config';

const HOME_URL = canonical('/');

export const metadata: Metadata = {
  title: siteTitle,
  description:
    'StudyCue Planner helps students plan weekly schedules, tasks, notes, focus sessions, flashcards, quizzes, group work, and Cue AI support in one calm workspace.',
  keywords: [...siteKeywords, 'student task planner', 'study schedule app', 'AI study assistant'],
  alternates: { canonical: HOME_URL },
  openGraph: {
    title: siteTitle,
    description: openGraphDescription,
    url: PRODUCTION_CANONICAL_ORIGIN,
    siteName,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: siteTitle,
    description: openGraphDescription,
  },
};

const audiences = [
  {
    title: 'Students balancing classes',
    body: 'Plan lectures, labs, review blocks, homework, and exam preparation without keeping separate lists in different apps.',
  },
  {
    title: 'Interns with changing schedules',
    body: 'Keep school deadlines visible while fitting study sessions around shifts, commutes, training days, and portfolio work.',
  },
  {
    title: 'Group project teams',
    body: 'Break a shared deadline into smaller responsibilities, meeting checkpoints, and follow-up tasks that are easier to track.',
  },
  {
    title: 'Online and hybrid classes',
    body: 'Turn video lessons, async readings, discussion boards, and online quizzes into a weekly plan with real time blocks.',
  },
];

const benefits = [
  'See classes, tasks, notes, and focus sessions together instead of rebuilding context every time you study.',
  'Convert vague goals such as "study biology" into dated tasks, review blocks, flashcards, and quiz practice.',
  'Use Cue AI as a planning assistant when your workload feels crowded and you need the next practical step.',
  'Keep a free student-friendly workspace during beta, supported by ads for Free plan experiences where applicable.',
];

const featurePreviews = [
  ['Calendar and schedules', 'Map class blocks, recurring study times, exam windows, and catch-up sessions.'],
  ['Tasks and deadlines', 'Track assignments, readings, project pieces, quizzes, and admin chores with due dates.'],
  ['Notes', 'Keep study notes near the planner context that made them useful in the first place.'],
  ['Focus timer', 'Start a dedicated work session when it is time to read, solve, draft, or review.'],
  ['Flashcards and quizzes', 'Turn study material into active recall practice before exam week arrives.'],
  ['Group Planning', 'Coordinate shared project milestones and meeting prep with less last-minute confusion.'],
];

const faqs = [
  {
    question: 'Is StudyCue Planner only for university students?',
    answer:
      'No. It is designed around student workflows, so it can help high school students, college students, interns, certification learners, and online class takers who need one place to organize study work.',
  },
  {
    question: 'Does the Free plan include ads?',
    answer:
      'The Free plan is designed to stay accessible and may include advertising. During beta, current features are free, and pricing or limits may change later with clear public updates.',
  },
  {
    question: 'Should I rely on Cue AI for final answers?',
    answer:
      'No. Cue AI is a planning and study assistant. Use it to organize priorities, explain study approaches, or generate practice prompts, then check important academic work against your course materials and school rules.',
  },
  {
    question: 'Can I read the policies before making an account?',
    answer:
      'Yes. StudyCue keeps the Terms, Privacy Policy, Cookies Policy, Help, Pricing, and Contact pages public so students and families can review them before signing up.',
  },
];

export default function LandingPage() {
  const website = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteName,
    alternateName: 'StudyCue',
    url: HOME_URL,
  };

  const webApplication = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: siteName,
    alternateName: 'StudyCue',
    url: HOME_URL,
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    description: structuredDataDescription,
    creator: {
      '@type': 'Organization',
      name: organizationName,
    },
  };

  return (
    <>
      <JsonLd data={[website, webApplication]} />
      <section className="space-y-6 text-center">
        <p className="mx-auto inline-flex rounded-full border border-border bg-surface px-4 py-1 text-[11px] font-medium uppercase tracking-widest text-accent">
          StudyCue Planner by Solutions DevHive
        </p>
        <h1 className="text-balance font-serif text-4xl tracking-tight text-text-primary sm:text-6xl md:text-[3.65rem]">
          A smart study planner for calmer school weeks.
        </h1>
        <p className="mx-auto max-w-3xl text-lg leading-8 text-text-secondary">
          StudyCue Planner brings class schedules, tasks, notes, focus sessions, flashcards, quizzes, group planning,
          and Cue AI into one student workspace. It is built for the real week: lectures, online modules, deadlines,
          review blocks, project meetings, and the small tasks that usually disappear until the night before.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/register"
            className="rounded-xl bg-accent px-7 py-3 text-base font-semibold text-white shadow-[var(--sc-shadow-accent)] hover:bg-accent-hover"
          >
            Start free
          </Link>
          <Link href="/features" className="rounded-xl border border-border px-7 py-3 text-text-secondary hover:bg-surface-2">
            Explore features
          </Link>
        </div>
        <p className="mx-auto max-w-2xl text-sm leading-7 text-text-muted">
          Current beta access is free. The Free plan may be supported by ads, and future pricing or feature limits may
          change after beta with updated public information on the <Link href="/pricing" className="font-semibold text-accent">Pricing page</Link>.
        </p>
      </section>

      <section className="mt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Who it is for</p>
        <h2 className="mt-3 font-serif text-3xl text-text-primary">Built for students with crowded, changing weeks.</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {audiences.map((item) => (
            <article key={item.title} className="rounded-[24px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)]">
              <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20 grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Key benefits</p>
          <h2 className="mt-3 font-serif text-3xl text-text-primary">Less scattered planning, more visible next steps.</h2>
          <p className="mt-4 text-base leading-8 text-text-secondary">
            StudyCue is not trying to replace your teacher, syllabus, or judgment. It gives you a single place to turn
            school obligations into a plan you can actually follow.
          </p>
        </div>
        <ul className="grid gap-4">
          {benefits.map((benefit) => (
            <li key={benefit} className="rounded-[20px] border border-border bg-surface px-5 py-4 text-sm leading-7 text-text-secondary shadow-[var(--sc-shadow-card)]">
              {benefit}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Feature preview</p>
            <h2 className="mt-3 font-serif text-3xl text-text-primary">The planner tools students use every week.</h2>
          </div>
          <Link href="/features" className="text-sm font-semibold text-accent">
            View all features
          </Link>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {featurePreviews.map(([title, body]) => (
            <article key={title} className="rounded-[24px] border border-border bg-surface p-5 shadow-[var(--sc-shadow-card)]">
              <h3 className="text-lg font-semibold text-text-primary">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-[28px] border border-border bg-surface p-7 shadow-[var(--sc-shadow-card)]">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">Cue AI assistant</p>
        <h2 className="mt-3 font-serif text-3xl text-text-primary">A planning assistant, not a shortcut around learning.</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-text-secondary">
          Cue AI helps students reason through messy workloads: what to start first, how to split a large assignment,
          which notes could become flashcards, or how to prepare for a quiz without cramming. It should be used
          responsibly, checked against course materials, and kept within your school&apos;s academic integrity rules.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/help#cue-ai" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2">
            Cue AI help
          </Link>
          <Link href="/terms#student-use-and-academic-integrity" className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2">
            Academic integrity
          </Link>
        </div>
      </section>

      <section className="mt-20 grid gap-6 md:grid-cols-3">
        {[
          ['1. Add your school week', 'Enter classes, study blocks, online sessions, internship shifts, and known deadlines.'],
          ['2. Turn work into tasks', 'Break readings, problem sets, papers, labs, and projects into smaller dated actions.'],
          ['3. Study with feedback loops', 'Use notes, flashcards, quizzes, focus sessions, and Cue AI prompts to keep improving the plan.'],
        ].map(([title, body]) => (
          <article key={title} className="rounded-[24px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)]">
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="mt-3 text-sm leading-7 text-text-secondary">{body}</p>
          </article>
        ))}
      </section>

      <section className="mt-20">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-text-muted">FAQ</p>
        <h2 className="mt-3 font-serif text-3xl text-text-primary">Before you create an account.</h2>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-[24px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)]">
              <h3 className="text-lg font-semibold text-text-primary">{faq.question}</h3>
              <p className="mt-3 text-sm leading-7 text-text-secondary">{faq.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-20 rounded-[28px] border border-border bg-surface p-7 shadow-[var(--sc-shadow-card)]">
        <h2 className="font-serif text-3xl text-text-primary">Review the public information.</h2>
        <p className="mt-3 max-w-3xl text-base leading-8 text-text-secondary">
          Learn how StudyCue works, what the free beta includes, how support works, and how privacy, cookies, ads, and
          terms are handled before you sign up.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {[
            ['/features', 'Features'],
            ['/pricing', 'Pricing'],
            ['/help', 'Help'],
            ['/privacy', 'Privacy'],
            ['/terms', 'Terms'],
          ].map(([href, label]) => (
            <Link key={href} href={href} className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2">
              {label}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
