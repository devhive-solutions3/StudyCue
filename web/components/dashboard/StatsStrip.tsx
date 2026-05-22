'use client';

import dayjs from 'dayjs';

import type { CloudMirrorV1 } from '@studycue/types';

/** Compact summary ribbon for homepage column 3. */
export default function StatsStrip({ mirror }: { mirror: CloudMirrorV1 }) {
  const cutoff = dayjs().subtract(7, 'day');

  let total = 0;
  mirror.sessions.forEach((s) => {
    if (!s.createdAt || dayjs(s.createdAt).isBefore(cutoff)) return;
    total += Number(s.focusMinutes ?? 0);
  });

  return (
    <div className="rounded-[16px] border border-border bg-surface p-5 text-sm shadow-[var(--shadow-sm)]">
      <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Rolling 7d</p>
      <p className="mt-2 text-4xl font-semibold text-text-primary">{total}</p>
      <p className="text-text-secondary">focused minutes synced from timers + mobile</p>
    </div>
  );
}
