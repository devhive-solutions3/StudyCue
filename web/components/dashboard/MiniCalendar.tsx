'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import type { CloudMirrorV1 } from '@studycue/types';

import { createLocalMonthCells, localDateKey, timestampToLocalDateKey } from '@/lib/local-date';

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function MiniCalendar({ mirror }: { mirror: CloudMirrorV1 }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const eventDays = useMemo(() => {
    const keys = new Set<string>();
    mirror.tasks.forEach((t) => {
      if (t.dueAt) keys.add(timestampToLocalDateKey(t.dueAt));
    });
    mirror.sessions.forEach((s) => {
      const raw = s.startedAt ?? s.createdAt;
      if (raw) keys.add(timestampToLocalDateKey(raw));
    });
    return keys;
  }, [mirror.sessions, mirror.tasks]);

  const cells = useMemo(() => {
    return createLocalMonthCells(year, month);
  }, [month, year]);

  const todayIso = localDateKey();

  function move(delta: number) {
    const next = new Date(year, month + delta, 1);
    setMonth(next.getMonth());
    setYear(next.getFullYear());
  }

  return (
    <section className="sc-panel">
      <header className="sc-panel-header">
        <p className="text-sm font-extrabold text-text-primary">Calendar</p>
        <Link href="/app/calendar" className="text-xs font-extrabold text-accent hover:underline">
          Full view
        </Link>
      </header>
      <div className="p-5">
        <div className="mb-2 flex items-center justify-between">
          <button type="button" onClick={() => move(-1)} className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-2">
            &lt;
          </button>
          <p className="text-sm font-extrabold text-text-primary">{MONTHS[month]} {year}</p>
          <button type="button" onClick={() => move(1)} className="rounded px-2 py-1 text-xs text-text-muted hover:bg-surface-2">
            &gt;
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAY_LABELS.map((d) => (
            <span key={d} className="py-1 text-[10px] font-medium text-text-muted">
              {d}
            </span>
          ))}
          {cells.map((cell) => {
            const today = cell.iso === todayIso;
            const hasEvent = eventDays.has(cell.iso);
            return (
              <span
                key={`${cell.iso}-${cell.day}`}
                className={[
                  'relative rounded-[10px] py-1.5 text-xs',
                  today ? 'bg-accent font-semibold text-white' : cell.otherMonth ? 'text-text-muted/50' : 'text-text-secondary hover:bg-surface-2',
                ].join(' ')}
              >
                {cell.day}
                {hasEvent && !today ? <i className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-purple-400" /> : null}
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
