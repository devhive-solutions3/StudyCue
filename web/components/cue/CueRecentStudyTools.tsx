'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
  fetchCueStudySessionList,
  formatCueSessionExpiresIn,
} from '@/lib/cue-study-session-client';
import type { CueStudySessionSummary } from '@/lib/cue-study-session-types';

export default function CueRecentStudyTools() {
  const [sessions, setSessions] = useState<CueStudySessionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchCueStudySessionList()
      .then((rows) => {
        if (!cancelled) setSessions(rows);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || sessions.length === 0) return null;

  return (
    <section className="mb-4 rounded-[18px] border border-border bg-surface-2/80 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-text-muted">Recent from Cue</p>
      <ul className="mt-3 space-y-3">
        {sessions.map((session) => {
          const href =
            session.type === 'quiz'
              ? `/app/quiz?sessionId=${encodeURIComponent(session.sessionId)}`
              : `/app/flashcards?sessionId=${encodeURIComponent(session.sessionId)}`;
          const label =
            session.type === 'quiz'
              ? `Quiz from ${session.sourceName}`
              : `Flashcards from ${session.sourceName}`;
          const countLabel =
            session.type === 'quiz'
              ? `${session.itemCount} question${session.itemCount === 1 ? '' : 's'}`
              : `${session.itemCount} card${session.itemCount === 1 ? '' : 's'}`;

          return (
            <li
              key={session.sessionId}
              className="rounded-[12px] border border-border bg-surface px-3 py-2.5"
            >
              <p className="text-sm font-medium text-text-primary">{label}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {countLabel} · {formatCueSessionExpiresIn(session.expiresAt)}
                {session.savedAt ? ' · saved' : ''}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link href={href} className="sc-btn-primary text-xs">
                  {session.type === 'quiz' ? 'Start quiz' : 'Review cards'}
                </Link>
                {session.savedTargetId ? (
                  <Link
                    href={
                      session.type === 'quiz'
                        ? `/app/quiz?retake=${encodeURIComponent(session.savedTargetId)}`
                        : '/app/flashcards'
                    }
                    className="sc-btn-secondary text-xs"
                  >
                    Open saved
                  </Link>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
