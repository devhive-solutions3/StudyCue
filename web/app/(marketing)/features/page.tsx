import type { Metadata } from 'next';

import GoogleAdSenseAd from '@/components/ads/GoogleAdSenseAd';

import { canonical } from '@/lib/site-config';

export const metadata: Metadata = {
  title: 'Features',
  description:
    'Explore StudyCue Planner features for class schedules, tasks, notes, focus sessions, Cue AI, and cross-device web access.',
  alternates: { canonical: canonical('/features') },
  openGraph: { title: 'StudyCue Features', url: canonical('/features') },
};

export default function FeaturesPage() {
  const blocks = [
    [
      'Calendar and schedules',
      'Build a class schedule, map weekly study blocks, and keep upcoming sessions visible in one calm planner view.',
    ],
    [
      'Tasks and deadlines',
      'Add homework, assignments, quizzes, and project deadlines so nothing gets lost between classes.',
    ],
    [
      'Notes',
      'Keep quick study notes beside your schedule so lecture takeaways and to-dos stay connected.',
    ],
    [
      'Focus timer',
      'Run focused study sessions with a timer built for students who want structure without extra noise.',
    ],
    [
      'Cue AI',
      'Use Cue AI to turn a messy workload into the next clear step when you are not sure what to tackle first.',
    ],
    [
      'Cross-device web access',
      'Open StudyCue Planner on the web from any modern browser and keep planning across your devices.',
    ],
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Product</p>
        <h1 className="font-serif text-4xl text-text-primary">StudyCue Planner features</h1>
        <p className="mt-3 max-w-3xl text-text-secondary">
          StudyCue Planner combines the essentials students actually use every week: a class schedule planner, homework
          tracker, note space, focus timer, and Cue AI support inside one online study planner.
        </p>
      </header>
      <section className="grid gap-4 md:grid-cols-2">
        {blocks.map(([title, body]) => (
          <article key={title} className="rounded-3xl border border-border bg-surface p-5 shadow-[var(--sc-shadow-card)]">
            <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
            <p className="mt-3 text-text-secondary">{body}</p>
          </article>
        ))}
      </section>
      <section className="rounded-3xl border border-border bg-surface p-6 shadow-[var(--sc-shadow-card)]">
        <h2 className="text-2xl font-semibold text-text-primary">How students use it</h2>
        <p className="mt-3 text-text-secondary">
          Start by laying out your classes and study blocks, add tasks with real deadlines, keep notes attached to your
          workflow, and use the focus timer when it is time to work. Cue AI helps when you need a quick planning nudge
          without leaving the same workspace.
        </p>
      </section>
      <GoogleAdSenseAd className="mt-10" />
    </div>
  );
}
