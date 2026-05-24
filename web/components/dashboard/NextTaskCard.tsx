'use client';

import Link from 'next/link';

import type { CloudMirrorV1 } from '@studycue/types';
import { isActiveTask } from '@/lib/study-task-sync';

function firstUpcomingTask(mirror: CloudMirrorV1) {
  const pending = mirror.tasks.filter((task) => isActiveTask(task));

  return [...pending].sort((a, b) => {
    const ad = a.dueAt ? Date.parse(a.dueAt) : Number.MAX_SAFE_INTEGER;
    const bd = b.dueAt ? Date.parse(b.dueAt) : Number.MAX_SAFE_INTEGER;
    return ad - bd;
  })[0];
}

export default function NextTaskCard({ mirror }: { mirror: CloudMirrorV1 }) {
  const task = firstUpcomingTask(mirror);
  return (
    <section className="rounded-[24px] bg-accent p-6 text-white shadow-[var(--shadow-accent)]">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] opacity-75">Up next</p>
      <h3 className="mt-3 font-serif text-3xl leading-tight tracking-[-0.04em]">{task?.title?.trim() || 'None'}</h3>
      <p className="mt-1 text-xs opacity-80">
        {task?.dueAt ? `Due ${new Date(task.dueAt).toLocaleDateString()}` : 'Add your first task to get started'}
      </p>
      <Link
        href="/app/chat"
        className="mt-5 inline-flex min-h-[42px] items-center rounded-[14px] border border-white/40 bg-white/20 px-4 text-xs font-extrabold hover:bg-white/30"
      >
        Start focus session
      </Link>
    </section>
  );
}
