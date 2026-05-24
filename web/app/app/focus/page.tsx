'use client';

import { useMemo, useState } from 'react';

import { useFocusTimer } from '@/context/focus-timer';
import { useMirror } from '@/context/mirror-context';

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

const QUICK_MINUTES = [25, 45, 60, 120];

function words(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);
}

function overlapScore(source: string[], target: string[]): number {
  if (source.length === 0 || target.length === 0) return 0;
  const targetSet = new Set(target);
  let score = 0;
  source.forEach((token) => {
    if (targetSet.has(token)) score += 1;
  });
  return score;
}

function isTaskDone(status: string | null | undefined) {
  return ['done', 'completed'].includes((status ?? '').toLowerCase());
}

export default function FocusRoutePage() {
  const { mirror } = useMirror();
  const {
    running,
    paused,
    remainingSeconds,
    sessionTitle: activeSessionTitle,
    connectedTaskId,
    startTimer,
    togglePause,
    addTime,
    stopTimer,
  } = useFocusTimer();

  const [sessionTitle, setSessionTitle] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [selectedMinutes, setSelectedMinutes] = useState(25);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);

  const logs = useMemo(() => {
    return [...mirror.sessions]
      .sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
      .slice(0, 20);
  }, [mirror.sessions]);

  const categoryLookup = useMemo(
    () => new Map(mirror.taskCategories.map((category) => [category.id, category])),
    [mirror.taskCategories],
  );

  const taskLookup = useMemo(
    () => new Map(mirror.tasks.map((task) => [task.id, task])),
    [mirror.tasks],
  );

  const categories = useMemo(
    () => [...mirror.taskCategories].sort((a, b) => a.name.localeCompare(b.name)),
    [mirror.taskCategories],
  );

  const openTasks = useMemo(
    () => mirror.tasks.filter((task) => !isTaskDone(task.status)),
    [mirror.tasks],
  );

  const tasksInSelectedCategory = useMemo(() => {
    if (selectedCategoryId == null) return openTasks;
    return openTasks.filter((task) => task.categoryId === selectedCategoryId);
  }, [openTasks, selectedCategoryId]);

  const suggestedTaskId = useMemo(() => {
    const titleTokens = words(sessionTitle);
    if (titleTokens.length === 0) return null;

    let bestTaskId: number | null = null;
    let bestScore = 0;

    mirror.tasks.forEach((task) => {
      if (!task.title?.trim()) return;
      const status = (task.status ?? '').toLowerCase();
      if (status === 'done' || status === 'completed') return;

      const taskTokens = words(task.title);
      const categoryTokens = words(categoryLookup.get(task.categoryId ?? -1)?.name ?? '');
      const score =
        overlapScore(titleTokens, taskTokens) * 2 +
        overlapScore(titleTokens, categoryTokens);

      if (score > bestScore) {
        bestScore = score;
        bestTaskId = task.id;
      }
    });

    return bestScore > 0 ? bestTaskId : null;
  }, [categoryLookup, mirror.tasks, sessionTitle]);

  const effectiveSelectedTaskId = useMemo(() => {
    if (selectedTaskId == null) return null;
    const task = taskLookup.get(selectedTaskId);
    return task && !isTaskDone(task.status) ? selectedTaskId : null;
  }, [selectedTaskId, taskLookup]);

  function resolveMinutes() {
    const custom = Number(customMinutes);
    if (Number.isFinite(custom) && custom >= 1) {
      return Math.round(custom);
    }
    return selectedMinutes;
  }

  function handleStartSession() {
    const minutes = resolveMinutes();
    startTimer({
      durationSeconds: minutes * 60,
      sessionTitle: sessionTitle.trim() || 'Focus session',
      connectedTaskId: effectiveSelectedTaskId,
    });
  }

  if (running || paused) {
    return (
      <div className="mx-auto flex min-h-[72vh] max-w-[940px] items-center justify-center">
        <section className="w-full rounded-[32px] border border-border bg-surface p-8 text-center shadow-[var(--shadow-md)]">
          <p className="text-xs uppercase tracking-[0.35em] text-accent">Stay focused</p>
          <h1 className="mt-4 text-[clamp(64px,8vw,108px)] font-extrabold leading-[0.92] tracking-[-0.08em] text-accent">
            {formatClock(remainingSeconds)}
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            {activeSessionTitle.trim() || 'Focus session'}
          </p>
          {connectedTaskId != null ? (
            <p className="mt-1 text-xs text-text-muted">
              Linked task: {taskLookup.get(connectedTaskId)?.title?.trim() || 'Task'}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={togglePause}
              className="rounded-full border border-border bg-surface-2 px-6 py-3 text-base font-extrabold text-text-primary hover:bg-surface"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              type="button"
              onClick={() => addTime(5)}
              className="rounded-full border border-border bg-surface-2 px-6 py-3 text-base font-extrabold text-text-primary hover:bg-surface"
            >
              +5 min
            </button>
            <button
              type="button"
              onClick={stopTimer}
              className="rounded-full bg-rose-500 px-6 py-3 text-base font-extrabold text-white hover:bg-rose-400"
            >
              End session
            </button>
          </div>
        </section>
      </div>
    );
  }

  const selectedDisplay = formatClock(resolveMinutes() * 60);

  return (
    <div className="mx-auto w-full min-w-0 max-w-full space-y-[22px] md:max-w-[1040px]">
      <section className="sc-panel min-h-[520px] w-full min-w-0 max-w-full rounded-[32px] p-6 shadow-[var(--sc-shadow-md)] md:p-[34px]">
        <div className="text-center">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.24em] text-text-muted">
            Focus timer
          </p>
          <h1 className="sc-page-title mt-2 text-text-primary">Start a focus session</h1>
          <div className="my-[28px] text-[clamp(72px,10vw,124px)] font-extrabold leading-[0.95] tracking-[-0.08em] text-accent">
            {selectedDisplay}
          </div>
          <p className="mx-auto max-w-xl text-sm text-text-secondary">
            Pick a duration, connect a task if useful, then lock into one calm study block.
          </p>
        </div>

        <div className="mt-8">
          <p className="text-sm font-extrabold text-text-secondary">Select duration</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_MINUTES.map((mins) => (
              <button
                key={mins}
                type="button"
                onClick={() => {
                  setSelectedMinutes(mins);
                  setCustomMinutes('');
                }}
                className={[
                  'min-h-[46px] rounded-full px-[22px] text-base font-extrabold',
                  selectedMinutes === mins && !customMinutes
                    ? 'bg-accent text-white shadow-[var(--shadow-accent)]'
                    : 'border border-border bg-surface-2 text-text-primary hover:bg-surface',
                ].join(' ')}
              >
                {mins >= 60 ? `${Math.floor(mins / 60)} hr` : `${mins} min`}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6">
          <p className="text-sm font-extrabold text-text-secondary">Or enter custom minutes</p>
          <input
            value={customMinutes}
            onChange={(e) => setCustomMinutes(e.target.value.replace(/[^\d]/g, ''))}
            placeholder="e.g. 35"
            className="sc-input mt-2 min-h-[52px] rounded-[15px] text-base"
          />
        </div>

        <div className="mt-6">
          <p className="text-sm font-extrabold text-text-secondary">Session title (optional)</p>
          <input
            value={sessionTitle}
            onChange={(e) => {
              setSessionTitle(e.target.value);
            }}
            placeholder="e.g. Chemistry review"
            className="sc-input mt-2 min-h-[52px] rounded-[15px] text-base"
          />
        </div>

        <div className="mt-6">
          <p className="text-sm font-extrabold text-text-secondary">Connect to a task (optional)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <select
              value={selectedCategoryId == null ? '' : String(selectedCategoryId)}
              onChange={(e) => {
                const raw = e.target.value;
                setSelectedCategoryId(raw ? Number(raw) : null);
                setSelectedTaskId(null);
              }}
              className="sc-input min-h-[52px] w-full appearance-none rounded-[15px] pr-10"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select
              value={effectiveSelectedTaskId == null ? '' : String(effectiveSelectedTaskId)}
              onChange={(e) => {
                const raw = e.target.value;
                setSelectedTaskId(raw ? Number(raw) : null);
              }}
              className="sc-input min-h-[52px] w-full appearance-none rounded-[15px] pr-10"
            >
              <option value="">No linked task</option>
              {tasksInSelectedCategory.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title?.trim() || `Task ${task.id}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {suggestedTaskId != null && effectiveSelectedTaskId !== suggestedTaskId ? (
          <button
            type="button"
            onClick={() => {
              setSelectedTaskId(suggestedTaskId);
              setSelectedCategoryId(taskLookup.get(suggestedTaskId)?.categoryId ?? null);
            }}
            className="sc-btn-secondary mt-3 text-xs"
          >
            Suggested match: {taskLookup.get(suggestedTaskId)?.title?.trim() || 'Task'}
          </button>
        ) : null}

        <button
          type="button"
          onClick={handleStartSession}
          className="mt-8 min-h-[64px] w-full rounded-full bg-accent px-6 text-[18px] font-extrabold text-white shadow-[var(--shadow-accent)] hover:bg-accent-hover"
        >
          Start session
        </button>
      </section>

      <section className="sc-panel rounded-[24px]">
        <div className="sc-panel-header">
          <h2 className="text-lg font-extrabold text-text-primary">Past focus sessions</h2>
        </div>
        <div className="space-y-2 p-5">
          {logs.length === 0 ? (
            <p className="text-sm text-text-muted">No sessions yet.</p>
          ) : (
            logs.map((session) => (
              <div
                key={session.id}
                className="min-h-[64px] rounded-[16px] border border-border bg-surface-2 px-[14px] py-3"
              >
                <p className="text-sm font-bold text-text-primary">
                  {session.title?.trim() || 'Focus session'}
                </p>
                <p className="text-xs text-text-muted">
                  {session.focusMinutes ?? 0} min ·{' '}
                  {session.createdAt
                    ? new Date(session.createdAt).toLocaleString()
                    : 'Saved'}
                </p>
                {session.taskId != null ? (
                  <p className="text-xs text-text-muted">
                    Linked task:{' '}
                    {taskLookup.get(session.taskId)?.title?.trim() ||
                      `Task ${session.taskId}`}
                  </p>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
