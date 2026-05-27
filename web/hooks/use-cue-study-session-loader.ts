'use client';

import { useEffect, useState } from 'react';

import { fetchCueStudySession } from '@/lib/cue-study-session-client';
import type { CueStudySessionDetail } from '@/lib/cue-study-session-types';
import { CUE_STUDY_SESSION_EXPIRED_MESSAGE } from '@/lib/cue-study-session-types';

export function useCueStudySessionLoader(
  sessionId: string | null,
  expectedType: 'quiz' | 'flashcards',
) {
  const [loading, setLoading] = useState(() => Boolean(sessionId));
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<CueStudySessionDetail | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    let cancelled = false;

    void fetchCueStudySession(sessionId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setSession(null);
        setError(result.message);
        setLoading(false);
        return;
      }
      if (result.session.type !== expectedType) {
        setSession(null);
        setError(CUE_STUDY_SESSION_EXPIRED_MESSAGE);
        setLoading(false);
        return;
      }
      setSession(result.session);
      setError(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [sessionId, expectedType]);

  return { loading: sessionId ? loading : false, error, session };
}
