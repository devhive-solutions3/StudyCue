'use client';

import Link from 'next/link';

import MiniCalendar from '@/components/dashboard/MiniCalendar';
import NextTaskCard from '@/components/dashboard/NextTaskCard';
import QuickActions from '@/components/dashboard/QuickActions';
import StatsGrid from '@/components/dashboard/StatsGrid';
import TasksColumn from '@/components/dashboard/TasksColumn';
import { useMirror } from '@/context/mirror-context';

export default function AppHomePage() {
  const { mirror } = useMirror();
  const openTasks = mirror.tasks.filter((task) => !['done', 'completed'].includes((task.status ?? '').toLowerCase())).length;

  return (
    <div className="space-y-[18px]">
      <section className="relative grid min-h-[300px] overflow-hidden rounded-[32px] border border-border bg-surface p-[30px] shadow-[var(--sc-shadow-md)] xl:grid-cols-[minmax(0,1fr)_360px]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(107,99,212,0.16), transparent 65%)' }}
        />
        <div className="relative z-10 flex flex-col justify-between gap-8">
          <div>
            <p className="text-[12px] font-extrabold uppercase tracking-[0.2em] text-text-muted">Study dashboard</p>
            <h2 className="sc-hero-title mt-4 max-w-[680px] text-text-primary">
              Plan calmly. Study clearly.
            </h2>
            <p className="mt-5 max-w-2xl text-base text-text-secondary">
              Keep your tasks, schedule, focus sessions, and Cue assistant in one soft workspace built for study flow.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className="sc-badge">{openTasks} open tasks</span>
            <span className="sc-badge bg-blue-50 text-blue-600">{mirror.classes.length} classes</span>
            <span className="sc-badge bg-teal-50 text-teal-600">{mirror.sessions.length} focus sessions</span>
          </div>
        </div>
        <div className="relative z-10 mt-8 min-h-[210px] rounded-[24px] p-6 text-white shadow-[var(--sc-shadow-accent)] xl:mt-0" style={{ background: 'linear-gradient(135deg, var(--sc-accent), #988FFF)' }}>
          <p className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-white/70">Focus cue</p>
          <h3 className="mt-4 text-3xl font-extrabold tracking-[-0.04em]">Ready for your next session?</h3>
          <p className="mt-3 text-sm text-white/78">Use Cue to turn the next task into a study plan, then start your timer.</p>
          <Link href="/app/focus" className="mt-6 inline-flex min-h-[42px] items-center rounded-[14px] bg-white/20 px-5 text-sm font-extrabold text-white ring-1 ring-white/30 transition hover:bg-white/28">
            Start focus
          </Link>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-[17px] font-extrabold text-text-primary">Today&apos;s Overview</p>
        <Link href="/app/stats" className="text-xs font-extrabold text-accent hover:underline">
          View all stats
        </Link>
      </div>

      <StatsGrid mirror={mirror} />

      <div className="grid gap-[18px] [grid-template-columns:1fr] xl:[grid-template-columns:minmax(0,1.7fr)_370px]">
        <TasksColumn mirror={mirror} />
        <div className="space-y-[18px]">
          <NextTaskCard mirror={mirror} />
          <MiniCalendar mirror={mirror} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
