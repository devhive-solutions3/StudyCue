import type { Metadata } from 'next';
import Link from 'next/link';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Help',
  description:
    'StudyCue Planner help guides for getting started, class schedules, tasks, focus timer, Cue AI, flashcards, quizzes, Group Planning, and account troubleshooting.',
  alternates: { canonical: canonical('/help') },
  openGraph: {
    title: 'StudyCue Planner Help',
    description:
      'Practical guides for students using StudyCue Planner to manage schedules, deadlines, notes, focus sessions, Cue AI, flashcards, quizzes, and group work.',
    url: canonical('/help'),
  },
};

const guides = [
  {
    id: 'getting-started',
    title: 'Getting started with StudyCue',
    steps: [
      'Create a free account, then open the dashboard as your daily starting point.',
      'Add fixed commitments first: classes, labs, online sessions, internship shifts, and known exam dates.',
      'Add tasks only after the week is visible, so due dates and study blocks are planned together.',
      'Pick one priority for the next focus session instead of trying to reorganize the entire semester at once.',
    ],
  },
  {
    id: 'class-schedule',
    title: 'How to add a class schedule',
    steps: [
      'Start with recurring classes and meetings because they define the space left for studying.',
      'Use clear names such as "Chem Lab" or "History Lecture" so the calendar is readable on mobile.',
      'Add location or online notes when they help you prepare before class.',
      'Leave buffer time around commute-heavy or lab-heavy days so the planner reflects your real energy.',
    ],
  },
  {
    id: 'tasks',
    title: 'How to create and organize tasks',
    steps: [
      'Write task titles as actions: "Outline essay intro" is easier to start than "Essay."',
      'Give every important task a due date, even if it is a self-imposed review deadline.',
      'Split large assignments into research, draft, revise, submit, and follow-up pieces.',
      'Review overdue tasks weekly and either reschedule them honestly or delete tasks that no longer matter.',
    ],
  },
  {
    id: 'focus-timer',
    title: 'How to use the focus timer',
    steps: [
      'Choose one task before starting the timer, such as solving ten problems or reviewing one lecture.',
      'Put distractions away for the session instead of relying on willpower halfway through.',
      'After the timer ends, write a short completion note or update the related task.',
      'Use shorter sessions when you are tired and longer sessions for deep reading, writing, or exam review.',
    ],
  },
  {
    id: 'cue-ai',
    title: 'How to use Cue AI responsibly',
    steps: [
      'Ask Cue AI to help plan, prioritize, summarize your own notes, or generate practice ideas.',
      'Do not use Cue AI to cheat, submit prohibited generated work, or bypass your school rules.',
      'Verify important facts, formulas, citations, and deadlines against official class materials.',
      'Keep prompts specific: include the course, deadline, constraints, and what you have already tried.',
    ],
  },
  {
    id: 'flashcards-quizzes',
    title: 'How to use flashcards and quizzes',
    steps: [
      'Turn definitions, formulas, mistakes, and lecture questions into flashcards soon after class.',
      'Use quizzes after reading or reviewing to test whether you can recall ideas without looking.',
      'Treat wrong answers as planning input: schedule a review block for the weak topic.',
      'Keep practice short and repeated across several days instead of saving everything for exam night.',
    ],
  },
  {
    id: 'group-planning',
    title: 'How Group Planning works',
    steps: [
      'Start with the shared deadline, then list the separate deliverables the group must finish.',
      'Create checkpoints for research, draft review, slide cleanup, rehearsal, and final submission.',
      'Assign follow-up tasks after each meeting so decisions do not disappear in chat threads.',
      'Use StudyCue to clarify responsibilities, while keeping direct communication with teammates.',
    ],
  },
  {
    id: 'login-account',
    title: 'Troubleshooting login and account issues',
    steps: [
      'If login fails, check that you are using the same sign-in method you used when creating the account.',
      'Use the forgot password page for email/password accounts and check spam or promotions folders.',
      'If Google sign-in gets stuck, try a fresh browser tab, disable strict third-party cookie blocking temporarily, or clear site storage.',
      'Contact support with your account email, device, browser, and the exact step where the problem happened.',
    ],
  },
];

export default function HelpPage() {
  return (
    <article className="space-y-10 text-text-primary">
      <header className="rounded-[32px] border border-border bg-surface px-6 py-8 shadow-[var(--sc-shadow-card)] md:px-8 md:py-10">
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Help</p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">StudyCue Planner help</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-text-secondary">
          Use these guides to set up StudyCue in a practical way: start with your schedule, add real tasks, study with
          focus sessions, and use Cue AI, flashcards, quizzes, and Group Planning as support tools.
        </p>
      </header>

      <nav className="flex flex-wrap gap-3" aria-label="Help guide sections">
        {guides.map((guide) => (
          <a
            key={guide.id}
            href={`#${guide.id}`}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-accent"
          >
            {guide.title}
          </a>
        ))}
      </nav>

      <section className="grid gap-6">
        {guides.map((guide) => (
          <section
            key={guide.id}
            id={guide.id}
            className="scroll-mt-28 rounded-[28px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)] md:p-7"
          >
            <h2 className="font-serif text-3xl text-text-primary">{guide.title}</h2>
            <ol className="mt-5 space-y-3 text-sm leading-7 text-text-secondary">
              {guide.steps.map((step) => (
                <li key={step} className="flex gap-3">
                  <span className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent">
                    {guide.steps.indexOf(step) + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </section>

      <section className="rounded-[28px] border border-border bg-surface p-7 shadow-[var(--sc-shadow-card)]">
        <h2 className="font-serif text-3xl text-text-primary">Still need help?</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-text-secondary">
          Contact the StudyCue team with a short description of the issue, the page or feature involved, your browser
          and device, and any steps that reproduce the problem. You can also review the <Link href="/features" className="font-semibold text-accent">Features</Link>, <Link href="/pricing" className="font-semibold text-accent">Pricing</Link>, <Link href="/privacy" className="font-semibold text-accent">Privacy</Link>, and <Link href="/terms" className="font-semibold text-accent">Terms</Link> pages before creating an account.
        </p>
        <Link
          href="/contact"
          className="mt-5 inline-flex rounded-xl border border-border px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-accent"
        >
          Contact support
        </Link>
      </section>
    </article>
  );
}
