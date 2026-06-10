import type { Metadata } from 'next';
import Link from 'next/link';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore StudyCue Planner features for schedules, tasks, notes, focus timer, flashcards, quizzes, Cue AI, Group Planning, and dashboard overview.',
  alternates: { canonical: canonical('/features') },
  openGraph: {
    title: 'StudyCue Planner Features',
    description:
      'A detailed guide to StudyCue Planner features for students managing classes, deadlines, notes, focus sessions, practice, and group work.',
    url: canonical('/features'),
  },
};

const features = [
  {
    id: 'calendar',
    title: 'Calendar and schedules',
    useCase: 'A student has lectures on Monday and Wednesday, a lab on Friday, and an online module due before Sunday.',
    benefit:
      'StudyCue helps map fixed class blocks first, then fit realistic study sessions around them so the week is easier to scan.',
    body:
      'Use the calendar to place classes, study blocks, exam windows, internship shifts, and catch-up time in one planning view. It is designed for weeks that change, not for perfect timetables that only work on paper.',
  },
  {
    id: 'tasks',
    title: 'Tasks and deadlines',
    useCase: 'A research paper, two readings, a quiz, and a group slide deck are all due in the same week.',
    benefit:
      'Tasks turn scattered obligations into visible next steps with due dates, so students can prioritize before everything feels urgent.',
    body:
      'Create tasks for homework, readings, project parts, forms, review sessions, and errands related to school. Keeping tasks close to your schedule makes it easier to see what can actually fit today.',
  },
  {
    id: 'notes',
    title: 'Notes',
    useCase: 'A lecture produces three key definitions, a question for office hours, and a reminder to review chapter six.',
    benefit:
      'Notes keep study context near the planner instead of losing it in a separate document that you forget to reopen.',
    body:
      'Use notes for lecture takeaways, review outlines, formulas, source links, draft ideas, or quick reminders. Notes can support later practice with flashcards, quizzes, and Cue AI prompts.',
  },
  {
    id: 'focus-timer',
    title: 'Focus timer',
    useCase: 'A student needs to read twenty pages but keeps switching tabs after a few minutes.',
    benefit:
      'The focus timer gives a clear start and stop point, making a study session feel concrete instead of endless.',
    body:
      'Start a timed session for reading, solving problems, outlining, reviewing flashcards, or drafting. The timer works best when paired with one specific task and a short note about what was completed.',
  },
  {
    id: 'flashcards',
    title: 'Flashcards',
    useCase: 'A biology exam requires terms, processes, diagrams, and common mistakes to be remembered accurately.',
    benefit:
      'Flashcards help students practice active recall before exam week instead of relying only on rereading notes.',
    body:
      'Use flashcards for definitions, formulas, vocabulary, historical events, language practice, and quick checks. They are most useful when cards are specific and reviewed in short sessions across several days.',
  },
  {
    id: 'quiz-generator',
    title: 'Quiz generator',
    useCase: 'A student finishes a chapter and wants to know whether they can answer questions without looking at the book.',
    benefit:
      'Practice questions reveal weak spots earlier, which makes review time more targeted and less stressful.',
    body:
      'The quiz generator can support review by turning study material into practice prompts. Students should still verify answers with class materials, especially for graded or high-stakes work.',
  },
  {
    id: 'cue-ai',
    title: 'Cue AI study assistant',
    useCase: 'A student opens the planner and sees too many tasks to decide where to begin.',
    benefit:
      'Cue AI can help sort priorities, break down assignments, suggest study approaches, and explain planning tradeoffs.',
    body:
      'Cue AI is built as a study planning assistant, not a replacement for learning or a source of guaranteed answers. Use it to clarify next steps, create practice ideas, and organize work responsibly.',
  },
  {
    id: 'group-planning',
    title: 'Group Planning',
    useCase: 'A group presentation needs research, slides, speaker notes, rehearsal, and final submission across several students.',
    benefit:
      'Group Planning helps shared schoolwork feel less chaotic by making milestones and responsibilities easier to discuss.',
    body:
      'Use StudyCue to plan meeting agendas, split project deliverables, track follow-ups, and keep a shared deadline visible. Group work still needs communication, but a clearer plan reduces last-minute guessing.',
  },
  {
    id: 'dashboard',
    title: 'Dashboard overview',
    useCase: 'A student wants to know what matters today without opening five different tools.',
    benefit:
      'The dashboard brings the day into focus by showing relevant schedule, task, and study context in one workspace.',
    body:
      'Use the dashboard as the starting point for each study session: check today&apos;s classes, review urgent tasks, open notes, start a timer, or ask Cue AI for help turning the workload into a next action.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="space-y-12">
      <header className="rounded-[32px] border border-border bg-surface px-6 py-8 shadow-[var(--sc-shadow-card)] md:px-8 md:py-10">
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Product</p>
        <h1 className="mt-3 font-serif text-4xl text-text-primary md:text-5xl">StudyCue Planner features</h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-text-secondary">
          StudyCue combines the study tools students use every week: schedule planning, tasks, notes, focus sessions,
          active recall practice, group project planning, and Cue AI. The goal is not to add noise. The goal is to keep
          schoolwork visible enough that the next step is easier to choose.
        </p>
      </header>

      <nav className="flex flex-wrap gap-3" aria-label="Feature sections">
        {features.map((feature) => (
          <a
            key={feature.id}
            href={`#${feature.id}`}
            className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-secondary hover:bg-surface-2 hover:text-accent"
          >
            {feature.title}
          </a>
        ))}
      </nav>

      <section className="grid gap-6">
        {features.map((feature) => (
          <article
            key={feature.id}
            id={feature.id}
            className="scroll-mt-28 rounded-[28px] border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)] md:p-7"
          >
            <h2 className="font-serif text-3xl text-text-primary">{feature.title}</h2>
            <p className="mt-4 text-base leading-8 text-text-secondary">{feature.body}</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-[18px] border border-border bg-surface-2 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Student use case</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{feature.useCase}</p>
              </div>
              <div className="rounded-[18px] border border-border bg-surface-2 p-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-text-muted">Student benefit</h3>
                <p className="mt-3 text-sm leading-7 text-text-secondary">{feature.benefit}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[28px] border border-border bg-surface p-7 shadow-[var(--sc-shadow-card)]">
        <h2 className="font-serif text-3xl text-text-primary">Start with the simplest workflow.</h2>
        <p className="mt-4 max-w-3xl text-base leading-8 text-text-secondary">
          Add your fixed class schedule, list the deadlines you already know, choose one task for the next study block,
          then use notes, flashcards, quizzes, or Cue AI only when they make the plan clearer. The <Link href="/help" className="font-semibold text-accent">Help page</Link> includes practical guides for each step.
        </p>
      </section>
    </div>
  );
}
