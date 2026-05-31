'use client';

import Image from 'next/image';
import Link from 'next/link';

import MiniCalendar from '@/components/dashboard/MiniCalendar';
import NextTaskCard from '@/components/dashboard/NextTaskCard';
import QuickActions from '@/components/dashboard/QuickActions';
import StatsGrid from '@/components/dashboard/StatsGrid';
import TasksColumn from '@/components/dashboard/TasksColumn';
import { useMirror } from '@/context/mirror-context';
import { isActiveTask } from '@/lib/study-task-sync';

export default function AppHomePage() {
  const { mirror } = useMirror();
  const openTasks = mirror.tasks.filter((task) => isActiveTask(task)).length;

  return (
    <div className="w-full min-w-0 max-w-full space-y-[18px]">
      <section className="dashboard-hero relative w-full min-w-0 max-w-full overflow-hidden rounded-[28px] border border-border bg-surface p-3 shadow-[var(--sc-shadow-md)] sm:p-4">
        <div
          aria-hidden="true"
          className="dashboard-hero-glow pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(107,99,212,0.12), transparent 65%)' }}
        />
        <div className="dashboard-hero-inner relative z-10 rounded-[24px] border border-violet-200/90 bg-white p-4 text-[#1E1B33] shadow-[0_18px_40px_rgba(67,56,120,0.11)] sm:p-5">
          <div className="grid grid-cols-[clamp(96px,24vw,120px)_minmax(0,1fr)] gap-2.5 xl:grid-cols-[clamp(150px,11vw,220px)_minmax(0,1fr)_minmax(220px,270px)] xl:items-center">
            <div className="dashboard-hero-cue-wrap relative flex min-w-[clamp(96px,24vw,120px)] items-center justify-center bg-transparent pt-1 xl:min-w-[clamp(150px,11vw,220px)] xl:justify-start xl:pt-0">
              <Image
                src="/assets/dashboard_cue.png"
                alt="Cue assistant"
                width={420}
                height={420}
                priority
                className="dashboard-hero-cue block h-auto w-[clamp(96px,24vw,120px)] object-contain drop-shadow-[0_18px_24px_rgba(109,93,211,0.22)] xl:w-[clamp(150px,11vw,210px)]"
              />
            </div>
            <div className="min-w-0">
              <p className="dashboard-hero-kicker text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8A84A3]">
                Study dashboard
              </p>
              <h2
                className="dashboard-hero-title hero-title mt-2 max-w-[620px] text-[28px] leading-[1] text-[#1E1B33] sm:text-[32px] xl:text-[42px]"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                Plan calmly. Study clearly.
              </h2>
              <p className="dashboard-hero-body mt-2 max-w-2xl text-[13px] leading-5 text-[#5F5A78] xl:text-[14px] xl:leading-6">
                Keep your tasks, schedule, focus sessions, and Cue assistant in one soft workspace built for study flow.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="dashboard-hero-pill-purple rounded-full bg-purple-50 px-3 py-1 text-[12px] font-extrabold text-purple-600">
                  {openTasks} open tasks
                </span>
                <span className="dashboard-hero-pill-blue rounded-full bg-blue-50 px-3 py-1 text-[12px] font-extrabold text-blue-600">
                  {mirror.classes.length} classes
                </span>
                <span className="dashboard-hero-pill-green rounded-full bg-teal-50 px-3 py-1 text-[12px] font-extrabold text-teal-600">
                  {mirror.sessions.length} focus sessions
                </span>
              </div>
            </div>
            <div className="dashboard-hero-focus-panel col-span-2 min-w-0 border-t border-violet-100 pt-3 xl:col-span-1 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end xl:block">
                <div className="min-w-0">
                  <p className="dashboard-hero-focus-label focus-label text-[11px] font-extrabold uppercase tracking-[0.18em] text-accent">
                    Focus cue
                  </p>
                  <h3 className="dashboard-hero-focus-title mt-2 text-[20px] font-extrabold leading-[1.08] text-[#1E1B33] xl:text-[22px]">
                    Ready for your next session?
                  </h3>
                  <p className="dashboard-hero-focus-body mt-2 text-[13px] leading-5 text-[#5F5A78] xl:text-sm xl:leading-6">
                    Use Cue to turn the next task into a study plan, then start your timer.
                  </p>
                </div>
                <Link
                  href="/app/focus"
                  className="inline-flex min-h-[36px] items-center rounded-[14px] bg-accent px-4 text-sm font-extrabold text-white shadow-[var(--sc-shadow-accent)] transition hover:opacity-90 xl:mt-3"
                >
                  Start focus
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex items-center justify-between">
        <p className="text-[17px] font-extrabold text-text-primary">Today&apos;s Overview</p>
        <Link href="/app/stats" className="text-xs font-extrabold text-accent hover:underline">
          View all stats
        </Link>
      </div>

      <StatsGrid mirror={mirror} />

      <div className="grid w-full min-w-0 max-w-full gap-[18px] [grid-template-columns:minmax(0,1fr)] xl:[grid-template-columns:minmax(0,1.7fr)_minmax(300px,370px)]">
        <TasksColumn mirror={mirror} />
        <div className="min-w-0 space-y-[18px]">
          <NextTaskCard mirror={mirror} />
          <MiniCalendar mirror={mirror} />
          <QuickActions />
        </div>
      </div>
    </div>
  );
}
