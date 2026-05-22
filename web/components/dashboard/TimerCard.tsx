'use client';

import clsx from 'clsx';
import dayjs from 'dayjs';
import type { FormEvent } from 'react';
import * as React from 'react';

import type { CloudMirrorV1 } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import { nextNumericId } from '@/lib/mirror-bootstrap';

function formatSeconds(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = Math.floor(total % 60)
    .toString()
    .padStart(2, '0');
  return `${m}:${s}`;
}

export default function TimerCard({ mirror }: { mirror: CloudMirrorV1 }) {
  const { commitMirror } = useMirror();
  const plannedSeconds = React.useMemo(
    () => (mirror.preferences?.preferredFocusMinutes ?? 25) * 60,
    [mirror.preferences?.preferredFocusMinutes],
  );

  const [remaining, setRemaining] = React.useState(plannedSeconds);
  const [running, setRunning] = React.useState(false);
  const startRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!startRef.current) return;
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
      setRemaining(Math.max(0, plannedSeconds - elapsed));
    }, 500);
    return () => window.clearInterval(id);
  }, [plannedSeconds, running]);

  React.useEffect(() => {
    setRemaining(plannedSeconds);
  }, [plannedSeconds]);

  function recordingMinutes() {
    if (!running || !startRef.current) return plannedSeconds / 60;
    const elapsed = (Date.now() - startRef.current) / 1000;
    return Math.min(plannedSeconds / 60, Math.max(1, Math.round(elapsed / 60)));
  }

  function recordSession() {
    const focusMinutes = Math.round(recordingMinutes());
    const now = dayjs().toISOString();
    commitMirror((prev) => {
      const id = nextNumericId(prev.sessions);
      return {
        ...prev,
        sessions: [
          ...prev.sessions,
          {
            id,
            subjectId: null,
            taskId: null,
            startedAt: now,
            endedAt: now,
            focusMinutes,
            completed: 1,
            createdAt: now,
          },
        ],
      };
    });

    startRef.current = null;
    setRunning(false);
    setRemaining(plannedSeconds);
  }

  function toggle(evt: React.MouseEvent | FormEvent) {
    evt.preventDefault();
    if (!running) {
      startRef.current = Date.now();
      setRunning(true);
      setRemaining(plannedSeconds);
      return;
    }
    recordSession();
  }

  const mins = mirror.preferences?.preferredFocusMinutes ?? 25;

  return (
    <section className="rounded-[16px] border border-border bg-surface p-5 shadow-[var(--shadow-sm)]">
      <p className="text-xs uppercase tracking-[0.35em] text-text-muted">Focus</p>
      <h2 className="text-2xl font-semibold text-text-primary">Focus timer</h2>
      <p className="text-sm text-text-secondary">{mins}-minute sprint</p>
      <p className="mt-6 text-center font-mono text-5xl text-text-primary">{formatSeconds(Math.max(0, remaining))}</p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={(e) => toggle(e)}
          className={clsx(
            'flex-1 rounded-[12px] py-3 text-sm font-semibold text-white',
            running ? 'bg-rose-500 hover:bg-rose-400' : 'bg-accent hover:bg-accent-hover',
          )}
        >
          {running ? 'Stop & save session' : 'Start'}
        </button>
      </div>
      <p className="mt-4 text-[11px] text-text-muted">
        Saves a summarized focus row into `study_sessions` in the mirrored JSON blob.
      </p>
    </section>
  );
}
