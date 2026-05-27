import { NextResponse } from 'next/server';

import { CUE_STUDY_SESSION_EXPIRED_MESSAGE } from '@/lib/cue-study-session-types';
import {
  getCueStudySessionForUser,
  markCueStudySessionOpened,
  markCueStudySessionSaved,
} from '@/lib/cue-study-sessions-server';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  const result = await getCueStudySessionForUser(viewer.uid, sessionId);

  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 404;
    return NextResponse.json(
      { error: CUE_STUDY_SESSION_EXPIRED_MESSAGE },
      { status },
    );
  }

  const { session } = result;
  void markCueStudySessionOpened(viewer.uid, sessionId);

  if (session.type === 'quiz') {
    return NextResponse.json({
      ok: true,
      session: {
        sessionId: session.sessionId,
        type: 'quiz' as const,
        sourceName: session.sourceName,
        sourceType: session.sourceType,
        title: session.title,
        itemCount: session.itemCount,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        savedAt: session.savedAt ?? null,
        savedTargetId: session.savedTargetId ?? null,
        requestedFolderName: session.requestedFolderName ?? null,
        questions: session.questions,
      },
    });
  }

  if (session.type === 'flashcards') {
    return NextResponse.json({
      ok: true,
      session: {
        sessionId: session.sessionId,
        type: 'flashcards' as const,
        sourceName: session.sourceName,
        sourceType: session.sourceType,
        title: session.title,
        itemCount: session.itemCount,
        createdAt: session.createdAt,
        expiresAt: session.expiresAt,
        savedAt: session.savedAt ?? null,
        savedTargetId: session.savedTargetId ?? null,
        requestedFolderName: session.requestedFolderName ?? null,
        cards: session.cards,
      },
    });
  }

  return NextResponse.json({ error: CUE_STUDY_SESSION_EXPIRED_MESSAGE }, { status: 404 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const { sessionId } = await context.params;
  let body: { savedTargetId?: string };
  try {
    body = (await request.json()) as { savedTargetId?: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const savedTargetId =
    typeof body.savedTargetId === 'string' ? body.savedTargetId.trim() : '';
  if (!savedTargetId) {
    return NextResponse.json({ error: 'savedTargetId is required.' }, { status: 400 });
  }

  const existing = await getCueStudySessionForUser(viewer.uid, sessionId);
  if (!existing.ok) {
    return NextResponse.json(
      { error: CUE_STUDY_SESSION_EXPIRED_MESSAGE },
      { status: existing.reason === 'expired' ? 410 : 404 },
    );
  }

  await markCueStudySessionSaved(viewer.uid, sessionId, savedTargetId);
  return NextResponse.json({ ok: true });
}
