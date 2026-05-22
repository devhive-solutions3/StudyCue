'use client';

import dayjs from 'dayjs';

import type { CloudMirrorV1 } from '@studycue/types';

function formatMinutes(total: number) {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default function StatsGrid({ mirror }: { mirror: CloudMirrorV1 }) {
  const today = dayjs();
  const todayName = today.format('dddd').toLowerCase();
  const classesToday = mirror.classes.filter((c) => (c.weekday ?? '').toLowerCase() === todayName).length;
  const focusToday = mirror.sessions
    .filter((s) => {
      const raw = s.startedAt ?? s.createdAt;
      if (!raw) return false;
      const dt = dayjs(raw);
      return dt.isValid() && dt.isSame(today, 'day');
    })
    .reduce((sum, s) => sum + Number(s.focusMinutes ?? 0), 0);
  const doneToday = mirror.tasks.filter((t) => {
    const status = (t.status ?? '').toLowerCase();
    if (!(status === 'completed' || status === 'done')) return false;
    const raw = t.createdAt;
    if (!raw) return false;
    const dt = dayjs(raw);
    return dt.isValid() && dt.isSame(today, 'day');
  }).length;

  const cards = [
    { label: 'Classes Today', value: String(classesToday), tone: 'purple' },
    { label: 'Focus Time', value: formatMinutes(focusToday), tone: 'blue' },
    { label: 'Tasks Done', value: String(doneToday), tone: 'teal' },
  ] as const;

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="flex min-h-[132px] items-start gap-4 rounded-[24px] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
          <span
            className={[
              'inline-flex h-12 w-12 items-center justify-center rounded-[16px] text-xs font-extrabold',
              card.tone === 'purple' ? 'bg-purple-50 text-purple-600' : card.tone === 'blue' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600',
            ].join(' ')}
          >
            {card.tone === 'purple' ? 'CL' : card.tone === 'blue' ? 'TM' : 'TK'}
          </span>
          <div>
            <p className="text-[32px] font-extrabold leading-none tracking-[-0.04em] text-text-primary">{card.value}</p>
            <p className="mt-2 text-xs font-bold text-text-muted">{card.label}</p>
          </div>
        </article>
      ))}
    </section>
  );
}
