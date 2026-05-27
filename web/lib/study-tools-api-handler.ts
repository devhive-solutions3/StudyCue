import 'server-only';

import { NextResponse } from 'next/server';

import { recordAiUsageLog } from '@/lib/ai-usage-logger';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { reserveCueRequestUsage } from '@/lib/server-usage-limits';
import { assertPremiumStudyToolsAccess } from '@/lib/study-tools-access';
import { isStudyAiDev, STUDY_AI_USER_ERRORS } from '@/lib/study-tools-ai-utils';
import { getUserPlanByUid } from '@/lib/server-user-plan';
import { STUDY_SOURCE_MAX_CHARS, STUDY_SOURCE_MIN_CHARS } from '@/lib/study-tools-types';

type StudyToolEndpoint =
  | '/api/study-tools/generate-quiz'
  | '/api/study-tools/generate-flashcards'
  | '/api/study-tools/file-study';

export async function runStudyToolRequest<T>(params: {
  request: Request;
  endpoint: StudyToolEndpoint;
  parseBody: (body: Record<string, unknown>) => { text: string; sourceName: string } | string;
  run: (input: { text: string; sourceName: string }) => Promise<T>;
}): Promise<NextResponse> {
  const viewer = await requireFirebaseAuth(params.request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const access = await assertPremiumStudyToolsAccess(viewer.uid);
  if (!access.allowed) {
    return NextResponse.json({ error: access.message }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await params.request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const parsed = params.parseBody(body);
  if (typeof parsed === 'string') {
    return NextResponse.json({ error: parsed }, { status: 400 });
  }

  const text = parsed.text.trim();
  if (!text) {
    return NextResponse.json({ error: 'Source text is required.' }, { status: 400 });
  }
  if (text.length < STUDY_SOURCE_MIN_CHARS) {
    return NextResponse.json(
      { error: `Source text must be at least ${STUDY_SOURCE_MIN_CHARS} characters.` },
      { status: 400 },
    );
  }
  if (text.length > STUDY_SOURCE_MAX_CHARS) {
    return NextResponse.json(
      { error: `Source text must be ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters or fewer.` },
      { status: 400 },
    );
  }

  if (isStudyAiDev()) {
    const plan = await getUserPlanByUid(viewer.uid);
    console.info('[study-tools-api] request', {
      endpoint: params.endpoint,
      uidExists: true,
      plan,
      sourceTextLength: text.length,
      sourceName: parsed.sourceName,
    });
  }

  const requestId = params.request.headers.get('x-studycue-request-id');
  const usage = await reserveCueRequestUsage(viewer.uid, {}, requestId);
  if (!usage.allowed) {
    return NextResponse.json(
      {
        error: usage.message ?? "You've reached your daily AI limit for your plan.",
        limit: usage.daily.limit,
        used: usage.daily.used,
        resetAt: usage.daily.resetAt,
      },
      { status: 429 },
    );
  }

  try {
    const result = await params.run({ text, sourceName: parsed.sourceName });
    const responseText = JSON.stringify(result);
    void recordAiUsageLog({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'success',
      requestPayload: {
        sourceName: parsed.sourceName,
        sourceLength: text.length,
        endpoint: params.endpoint,
      },
      responseText: responseText.slice(0, 500),
      endpoint: params.endpoint,
    }).catch(() => {});

    const headers = new Headers();
    headers.set('x-studycue-cue-daily-limit', String(usage.daily.limit));
    headers.set('x-studycue-cue-daily-used', String(usage.daily.used));
    headers.set('x-studycue-cue-daily-reset-at', usage.daily.resetAt);

    return NextResponse.json({ ok: true, ...result }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generation failed.';
    const status = mapStudyToolErrorStatus(message);
    if (isStudyAiDev()) {
      console.warn('[study-tools-api] generation failed', {
        endpoint: params.endpoint,
        sourceTextLength: text.length,
        message,
        status,
      });
    }
    void recordAiUsageLog({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'error',
      requestPayload: {
        sourceName: parsed.sourceName,
        sourceLength: text.length,
        endpoint: params.endpoint,
      },
      responseText: '',
      errorCode: 'generation_failed',
      endpoint: params.endpoint,
    }).catch(() => {});

    return NextResponse.json({ error: message }, { status });
  }
}

function mapStudyToolErrorStatus(message: string): number {
  if (message === STUDY_AI_USER_ERRORS.noProvider) return 503;
  if (/daily AI limit/i.test(message)) return 429;
  if (/Beta and StudyCue Plus/i.test(message)) return 403;
  if (/invalid quiz format|invalid flashcards format|invalid study format/i.test(message)) {
    return 502;
  }
  return 502;
}

export function parseStudySourceBody(body: Record<string, unknown>) {
  const text = typeof body.text === 'string' ? body.text : '';
  const sourceName =
    typeof body.sourceName === 'string' && body.sourceName.trim()
      ? body.sourceName.trim()
      : 'Study source';
  return { text, sourceName };
}

export function parseNumQuestions(body: Record<string, unknown>, fallback = 10): number | string {
  const raw = body.numQuestions;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return 'numQuestions must be a number.';
  const rounded = Math.round(num);
  if (rounded < 5 || rounded > 30) return 'numQuestions must be between 5 and 30.';
  return rounded || fallback;
}

export function parseNumCards(body: Record<string, unknown>, fallback = 10): number | string {
  const raw = body.numCards;
  const num = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(num)) return 'numCards must be a number.';
  const rounded = Math.round(num);
  if (rounded < 5 || rounded > 50) return 'numCards must be between 5 and 50.';
  return rounded || fallback;
}
