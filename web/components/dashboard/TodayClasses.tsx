'use client';

import dayjs from 'dayjs';

import type { CloudMirrorV1 } from '@studycue/types';

export default function TodayClasses({ mirror }: { mirror: CloudMirrorV1 }) {
  const label = dayjs().format('dddd');
  const today = mirror.classes.filter((c) => (c.weekday ?? '').toLowerCase() === label.toLowerCase());

  return (
    <section className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Classes · {label}</h2>
        <span className="text-[11px] uppercase tracking-[0.3em] text-text-muted">{today.length} today</span>
      </div>
      <div className="mt-5 space-y-3">
        {today.length === 0 ? (
          <EmptyRow message="Nothing scheduled locally for this weekday label — edit on mobile or tweak calendar view." />
        ) : (
          today.map((c) => (
            <div key={c.id} className="rounded-[12px] border border-border bg-surface-2 px-4 py-3 text-sm">
              <p className="font-semibold text-text-primary">{c.title ?? 'Untitled course'}</p>
              <p className="text-text-secondary">
                {c.startTime ?? '—'} – {c.endTime ?? '—'} ·{' '}
                <span className="text-text-muted">{c.location ?? 'campus / online'}</span>
              </p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="rounded-[12px] border border-dashed border-border px-4 py-6 text-sm text-text-muted">{message}</p>;
}
