'use client';

import dayjs from 'dayjs';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useMirror } from '@/context/mirror-context';
import type { StudySessionItem } from '@studycue/types';

dayjs.extend(isSameOrBefore);

function formatFocusTime(totalMinutes: number): string {
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function calcStreak(sessions: StudySessionItem[]): number {
  if (sessions.length === 0) return 0;
  const today = dayjs().startOf('day');
  let streak = 0;
  let cursor = today;
  while (true) {
    const isoDate = cursor.format('YYYY-MM-DD');
    const hasSession = sessions.some((s) => {
      const iso = s.startedAt ?? s.createdAt;
      return iso && dayjs(iso).format('YYYY-MM-DD') === isoDate;
    });
    if (!hasSession) break;
    streak++;
    cursor = cursor.subtract(1, 'day');
  }
  return streak;
}

function getRecommendation(sessions: StudySessionItem[]): { emoji: string; text: string } | null {
  const recent = sessions.filter((s) => {
    const iso = s.startedAt ?? s.createdAt;
    return iso && dayjs(iso).isAfter(dayjs().subtract(7, 'day'));
  });

  if (sessions.length === 0) {
    return {
      emoji: '👋',
      text: "Start your first focus session to see personalized tips!",
    };
  }

  if (recent.length === 0) {
    return {
      emoji: '⏰',
      text: "You haven't studied in a while — even a short 25-minute session today can help!",
    };
  }

  const totalMins = recent.reduce((sum, s) => sum + (s.focusMinutes ?? 0), 0);
  const avgMins = totalMins / recent.length;

  if (avgMins < 10) {
    return {
      emoji: '💡',
      text: "Your sessions are quite short. Try a 25-minute focused block — it's proven to boost retention and build momentum.",
    };
  }
  if (avgMins > 180) {
    return {
      emoji: '🛑',
      text: "You're studying for very long stretches without stopping. Take a 10–15 minute break every 90 minutes to avoid burnout and keep your memory sharp.",
    };
  }
  if (avgMins >= 120 && avgMins <= 180) {
    return {
      emoji: '☕',
      text: "Great focus! For sessions over 2 hours, short breaks in between will help you absorb material much better.",
    };
  }
  if (avgMins >= 60 && avgMins < 120) {
    return {
      emoji: '🔥',
      text: "Solid study blocks! Keep it up — 60–90 minute sessions with short breaks are close to ideal for deep learning.",
    };
  }
  if (avgMins >= 25 && avgMins < 60) {
    return {
      emoji: '⭐',
      text: "You're nailing it! Consistent 25–60 minute sessions are a sweet spot for focused, effective studying.",
    };
  }
  return null;
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="flex min-h-[160px] flex-col justify-between gap-3 rounded-[24px] border border-border bg-surface p-[22px] shadow-[var(--shadow-sm)]">
      <div
        className={[
          'flex h-[52px] w-[52px] items-center justify-center rounded-[17px]',
          accent ?? 'bg-accent/10',
        ].join(' ')}
      >
        {icon}
      </div>
      <p className="text-[34px] font-extrabold leading-none tracking-[-0.04em] text-text-primary">{value}</p>
      <p className="text-xs font-bold text-text-muted">{label}</p>
    </div>
  );
}

export default function StatsRoutePage() {
  const { mirror } = useMirror();
  const since30 = dayjs().subtract(30, 'day');

  const recentSessions = useMemo(
    () =>
      mirror.sessions.filter((s) => {
        const iso = s.startedAt ?? s.createdAt;
        return iso && dayjs(iso).isAfter(since30);
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mirror.sessions],
  );

  const totalMinutes = useMemo(
    () => recentSessions.reduce((sum, s) => sum + (s.focusMinutes ?? 0), 0),
    [recentSessions],
  );

  const completedSessions = useMemo(
    () => recentSessions.filter((s) => s.completed === 1).length,
    [recentSessions],
  );

  const tasksCompleted = useMemo(
    () =>
      mirror.tasks.filter((t) => {
        const status = (t.status ?? '').toLowerCase();
        return status === 'done' || status === 'completed';
      }).length,
    [mirror.tasks],
  );

  const avgSessionMinutes = useMemo(
    () => (completedSessions > 0 ? Math.round(totalMinutes / completedSessions) : 0),
    [totalMinutes, completedSessions],
  );

  const streak = useMemo(() => calcStreak(mirror.sessions), [mirror.sessions]);

  const recommendation = useMemo(() => getRecommendation(mirror.sessions), [mirror.sessions]);

  // Weekly bar chart data (by day-of-week, last 30d)
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totals = new Array<number>(7).fill(0);
  recentSessions.forEach((s) => {
    const iso = s.startedAt ?? s.createdAt;
    if (!iso) return;
    const idx = dayjs(iso).day();
    totals[idx] += Number(s.focusMinutes ?? 0);
  });
  const chartData = totals.map((minutes, idx) => ({ day: labels[idx], minutes }));

  return (
    <div className="sc-app-page w-full min-w-0 max-w-full space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Insights</p>
        <h1 className="sc-page-title mt-1 text-text-primary">Statistics</h1>
        <p className="mt-1 text-sm text-text-secondary">Your focus history and task progress.</p>
      </div>

      {/* Hero card – Total Focus Time + Streak */}
      <div className="flex min-h-[128px] w-full min-w-0 max-w-full flex-wrap items-center justify-between gap-5 rounded-[28px] border border-border bg-surface px-5 py-6 shadow-[var(--shadow-sm)] md:px-7">
        <div className="flex min-w-0 items-center gap-5">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-accent/10">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-[clamp(42px,4vw,48px)] font-extrabold leading-none tracking-[-0.055em] text-text-primary">{formatFocusTime(totalMinutes)}</p>
          <p className="mt-0.5 text-sm text-text-muted">Total Focus Time (last 30 days)</p>
        </div>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-semibold text-orange-600">
            <span>🔥</span>
            <span>{streak}</span>
          </div>
        )}
      </div>

      {/* 2×2 stat grid */}
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Completed Sessions"
          value={String(completedSessions)}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
          accent="bg-accent/10"
        />
        <StatCard
          label="Tasks Completed"
          value={String(tasksCompleted)}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-600"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          }
          accent="bg-emerald-100"
        />
        <StatCard
          label="Avg. Session Length"
          value={formatFocusTime(avgSessionMinutes)}
          icon={
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-violet-500"
            >
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          }
          accent="bg-violet-100"
        />
        <StatCard
          label="Day Streak"
          value={String(streak)}
          icon={<span className="text-xl">🔥</span>}
          accent="bg-orange-100"
        />
      </div>

      {/* Recommendation */}
      {recommendation && (
        <div className="flex min-w-0 items-start gap-4 rounded-[22px] border border-border bg-surface px-[22px] py-[18px] shadow-[var(--shadow-sm)]">
          <span className="text-3xl">{recommendation.emoji}</span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Quick tip for you</p>
            <p className="mt-0.5 text-sm text-text-secondary">{recommendation.text}</p>
          </div>
        </div>
      )}

      {/* Weekly chart */}
      <section className="sc-panel min-h-[420px]">
        <div className="flex min-h-[64px] items-center justify-between border-b border-border px-[22px] py-[18px]">
          <p className="text-sm font-extrabold text-text-primary">
            Focus minutes by day (last 30 days)
          </p>
        </div>
        <div className="h-[360px] bg-surface p-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 16, bottom: 0, left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e1f0" vertical={false} />
              <XAxis dataKey="day" stroke="#9b99b5" tick={{ fontSize: 12 }} />
              <YAxis stroke="#9b99b5" width={38} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: 'rgba(238,237,254,0.55)' }}
                contentStyle={{
                  background: '#ffffff',
                  borderRadius: '12px',
                  border: '1px solid #e2e1f0',
                  fontSize: '13px',
                }}
                formatter={(value) => [`${value ?? 0} min`, 'Focus']}
              />
              <Bar dataKey="minutes" radius={[10, 10, 0, 0]} fill="#6b63d4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
