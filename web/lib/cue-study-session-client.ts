'use client';

import type {
  CueStudySessionDetail,
  CueStudySessionSummary,
} from '@/lib/cue-study-session-types';
import { CUE_STUDY_SESSION_EXPIRED_MESSAGE } from '@/lib/cue-study-session-types';

export async function fetchCueStudySessionList(): Promise<CueStudySessionSummary[]> {
  const res = await fetch('/api/cue/study-sessions', { credentials: 'include' });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as { sessions?: CueStudySessionSummary[] } | null;
  return data?.sessions ?? [];
}

export async function fetchCueStudySession(sessionId: string): Promise<
  | { ok: true; session: CueStudySessionDetail }
  | { ok: false; message: string }
> {
  const res = await fetch(`/api/cue/study-sessions/${encodeURIComponent(sessionId)}`, {
    credentials: 'include',
  });
  const data = (await res.json().catch(() => null)) as
    | { ok: true; session: CueStudySessionDetail }
    | { error?: string }
    | null;

  if (res.status === 404 || res.status === 410) {
    return {
      ok: false,
      message: data && 'error' in data && data.error ? String(data.error) : CUE_STUDY_SESSION_EXPIRED_MESSAGE,
    };
  }
  if (!res.ok || !data || !('ok' in data) || !data.ok) {
    return {
      ok: false,
      message:
        data && 'error' in data && data.error
          ? String(data.error)
          : CUE_STUDY_SESSION_EXPIRED_MESSAGE,
    };
  }
  return { ok: true, session: data.session };
}

export async function patchCueStudySessionSaved(sessionId: string, savedTargetId: string) {
  await fetch(`/api/cue/study-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ savedTargetId }),
  });
}

export function formatCueSessionExpiresIn(expiresAt: string): string {
  const ms = Date.parse(expiresAt) - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return 'expired';
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `expires in ${hours}h`;
  const minutes = Math.max(1, Math.floor(ms / (60 * 1000)));
  return `expires in ${minutes}m`;
}
