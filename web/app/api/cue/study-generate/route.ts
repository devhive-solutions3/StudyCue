import { NextResponse } from 'next/server';

import {
  CUE_STUDY_BOTH_MESSAGE,
  CUE_STUDY_NO_SOURCE_MESSAGE,
  type CueStudyCommandType,
} from '@/lib/cue-study-command';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { assertPremiumStudyToolsAccess } from '@/lib/study-tools-access';
import { CUE_STUDY_PLAN_DENIED_MESSAGE } from '@/lib/cue-study-command';
import { studyToolsRateLimitMessage } from '@/lib/study-tools-time';
import {
  generateFlashcardsForUser,
  generateQuizForUser,
  StudyToolsPlanDeniedError,
  StudyToolsRateLimitError,
  StudyToolsValidationError,
} from '@/lib/study-tools-server';
import { createCueStudySession } from '@/lib/cue-study-sessions-server';
import type { CueStudySessionSourceType } from '@/lib/cue-study-session-types';
import type { StudySourceType } from '@/lib/study-tools-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const viewer = await requireFirebaseAuth(request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const access = await assertPremiumStudyToolsAccess(viewer.uid);
  if (!access.allowed) {
    return NextResponse.json(
      { error: CUE_STUDY_PLAN_DENIED_MESSAGE, code: 'plan_denied' },
      { status: 403 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const commandType = body.commandType as CueStudyCommandType | undefined;
  if (commandType === 'both') {
    return NextResponse.json({ error: CUE_STUDY_BOTH_MESSAGE, code: 'both_commands' }, { status: 400 });
  }
  if (commandType !== 'quiz' && commandType !== 'flashcards') {
    return NextResponse.json({ error: 'Invalid study command.' }, { status: 400 });
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return NextResponse.json({ error: CUE_STUDY_NO_SOURCE_MESSAGE }, { status: 400 });
  }

  const sourceName =
    typeof body.sourceName === 'string' && body.sourceName.trim()
      ? body.sourceName.trim()
      : 'Study source';
  const sourceType: StudySourceType =
    body.sourceType === 'paste' || body.sourceType === 'upload' || body.sourceType === 'notes'
      ? body.sourceType
      : 'upload';
  const sessionSourceType: CueStudySessionSourceType =
    sourceType === 'paste' ? 'paste' : sourceType === 'notes' ? 'notes' : 'cue_attachment';
  const count =
    typeof body.count === 'number' && Number.isFinite(body.count)
      ? Math.round(body.count)
      : commandType === 'quiz'
        ? 10
        : 20;
  const requestedFolderName =
    typeof body.requestedFolderName === 'string' ? body.requestedFolderName.trim() || null : null;

  const requestId = request.headers.get('x-studycue-request-id');

  try {
    if (commandType === 'quiz') {
      const { quiz, daily } = await generateQuizForUser({
        uid: viewer.uid,
        email: viewer.email,
        text,
        sourceName,
        sourceType,
        numQuestions: count,
        logEndpoint: '/api/cue',
        requestId,
        sourceSurface: 'cue_ai',
      });
      const headers = new Headers();
      headers.set('x-studycue-study-tool-daily-limit', String(daily.limit));
      headers.set('x-studycue-study-tool-daily-used', String(daily.used));
      headers.set('x-studycue-study-tool-daily-reset-at', daily.resetAt);
      const session = await createCueStudySession({
        uid: viewer.uid,
        type: 'quiz',
        sourceName,
        sourceType: sessionSourceType,
        questions: quiz,
        requestedFolderName,
      });
      if (!session?.sessionId) {
        return NextResponse.json(
          { error: 'Could not save your temporary quiz session. Please try again.' },
          { status: 503 },
        );
      }

      return NextResponse.json(
        {
          ok: true,
          kind: 'quiz' as const,
          message: `I created a ${quiz.length}-question quiz from ${sourceName}.`,
          sourceName,
          count: quiz.length,
          requestedFolderName,
          quiz,
          sessionId: session?.sessionId ?? null,
          expiresAt: session?.expiresAt ?? null,
        },
        { headers },
      );
    }

    const { flashcards, daily } = await generateFlashcardsForUser({
      uid: viewer.uid,
      email: viewer.email,
      text,
      sourceName,
      sourceType,
      numCards: count,
      logEndpoint: '/api/cue',
      requestId,
      sourceSurface: 'cue_ai',
    });
    const headers = new Headers();
    headers.set('x-studycue-study-tool-daily-limit', String(daily.limit));
    headers.set('x-studycue-study-tool-daily-used', String(daily.used));
    headers.set('x-studycue-study-tool-daily-reset-at', daily.resetAt);
    const session = await createCueStudySession({
      uid: viewer.uid,
      type: 'flashcards',
      sourceName,
      sourceType: sessionSourceType,
      cards: flashcards,
      requestedFolderName,
    });
    if (!session?.sessionId) {
      return NextResponse.json(
        { error: 'Could not save your temporary flashcard session. Please try again.' },
        { status: 503 },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        kind: 'flashcards' as const,
        message: `I created ${flashcards.length} flashcards from ${sourceName}.`,
        sourceName,
        count: flashcards.length,
        requestedFolderName,
        flashcards,
        sessionId: session?.sessionId ?? null,
        expiresAt: session?.expiresAt ?? null,
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof StudyToolsPlanDeniedError) {
      return NextResponse.json(
        { error: CUE_STUDY_PLAN_DENIED_MESSAGE, code: 'plan_denied' },
        { status: 403 },
      );
    }
    if (error instanceof StudyToolsRateLimitError) {
      return NextResponse.json(
        {
          error: studyToolsRateLimitMessage(error.daily.resetAt),
          limit: error.daily.limit,
          used: error.daily.used,
          resetAt: error.daily.resetAt,
        },
        { status: 429 },
      );
    }
    if (error instanceof StudyToolsValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : 'Generation failed.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
