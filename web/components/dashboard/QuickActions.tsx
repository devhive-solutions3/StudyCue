'use client';

import Link from 'next/link';

import { useDashboardUi } from '@/context/dashboard-ui';

export default function QuickActions() {
  const { signalNewTask } = useDashboardUi();
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[17px] font-extrabold text-text-primary">Quick Actions</p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-[480px]:grid-cols-1">
        <button
          type="button"
          onClick={() => signalNewTask()}
          className="flex min-h-[52px] items-center gap-2 rounded-[16px] border border-border bg-surface-2 px-3 py-3 text-xs font-extrabold text-text-primary hover:border-purple-200 hover:bg-accent-light"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center text-[11px]">+</span> New Task
        </button>
        <Link
          href="/app/focus"
          className="flex min-h-[52px] items-center gap-2 rounded-[16px] border border-border bg-surface-2 px-3 py-3 text-xs font-extrabold text-text-primary hover:border-purple-200 hover:bg-accent-light"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center text-[11px]">T</span> Start Timer
        </Link>
        <Link
          href="/app/calendar"
          className="flex min-h-[52px] items-center gap-2 rounded-[16px] border border-border bg-surface-2 px-3 py-3 text-xs font-extrabold text-text-primary hover:border-purple-200 hover:bg-accent-light"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center text-[11px]">C</span> Add Class
        </Link>
        <Link
          href="/app/notes"
          className="flex min-h-[52px] items-center gap-2 rounded-[16px] border border-border bg-surface-2 px-3 py-3 text-xs font-extrabold text-text-primary hover:border-purple-200 hover:bg-accent-light"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center text-[11px]">N</span> Quick Note
        </Link>
      </div>
    </section>
  );
}
