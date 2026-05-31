import 'server-only';

import { NextResponse } from 'next/server';

import type { VerifiedFirebaseUser } from '@/lib/firebase-server-auth';
import {
  StudyToolsPlanDeniedError,
  StudyToolsRateLimitError,
  StudyToolsValidationError,
} from '@/lib/study-tools-server';
import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { STUDY_TOOLS_PLAN_DENIED_MESSAGE } from '@/lib/study-tools-request';
import { isStudyAiDev, STUDY_AI_USER_ERRORS } from '@/lib/study-tools-ai-utils';
import { STUDY_PROVIDER_USER_ERRORS } from '@/lib/study-tools-provider-fallback';
import type { StudyToolEndpoint } from '@/lib/study-tools-usage-log';

export type { StudyToolEndpoint };

function dailyHeaders(daily: { limit: number; used: number; resetAt: string }) {
  const headers = new Headers();
  headers.set('x-studycue-study-tool-daily-limit', String(daily.limit));
  headers.set('x-studycue-study-tool-daily-used', String(daily.used));
  headers.set('x-studycue-study-tool-daily-reset-at', daily.resetAt);
  return headers;
}

function mapStudyToolError(error: unknown): { message: string; status: number } {
  if (error instanceof StudyToolsPlanDeniedError) {
    return { message: error.message, status: 403 };
  }
  if (error instanceof StudyToolsRateLimitError) {
    return {
      message: error.message,
      status: 429,
    };
  }
  if (error instanceof StudyToolsValidationError) {
    return { message: error.message, status: 400 };
  }
  const message = error instanceof Error ? error.message : 'Generation failed.';
  if (message === STUDY_AI_USER_ERRORS.noProvider) return { message, status: 503 };
  if (message === STUDY_AI_USER_ERRORS.providerUnavailable) return { message, status: 503 };
  if (message === STUDY_PROVIDER_USER_ERRORS.allRateLimited) return { message, status: 503 };
  if (message === STUDY_PROVIDER_USER_ERRORS.providerQuotaUnknown) return { message, status: 503 };
  if (message.startsWith('AI quota reached.')) return { message, status: 503 };
  if (/invalid quiz format|invalid flashcards format|invalid study format/i.test(message)) {
    return { message, status: 502 };
  }
  return { message, status: 502 };
}

export async function runStudyToolRequest<T>(params: {
  request: Request;
  endpoint: StudyToolEndpoint;
  parseBody: (body: Record<string, unknown>) => { text: string; sourceName: string } | string;
  run: (input: {
    viewer: VerifiedFirebaseUser;
    text: string;
    sourceName: string;
    requestId: string | null;
  }) => Promise<{ data: T; daily: { limit: number; used: number; resetAt: string } }>;
}): Promise<NextResponse> {
  const viewer = await requireFirebaseAuth(params.request);
  if (!viewer) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
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

  const requestId = params.request.headers.get('x-studycue-request-id');

  if (isStudyAiDev()) {
    console.info('[study-tools-api]', {
      endpoint: params.endpoint,
      uidExists: true,
      textLength: parsed.text.length,
      sourceNameLength: parsed.sourceName.length,
    });
  }

  try {
    const { data, daily } = await params.run({
      viewer,
      text: parsed.text,
      sourceName: parsed.sourceName,
      requestId,
    });
    return NextResponse.json({ ok: true, ...data }, { headers: dailyHeaders(daily) });
  } catch (error) {
    const mapped = mapStudyToolError(error);
    if (error instanceof StudyToolsRateLimitError) {
      return NextResponse.json(
        {
          error: mapped.message,
          limit: error.daily.limit,
          used: error.daily.used,
          resetAt: error.daily.resetAt,
          resetLabel: error.daily.resetLabel,
          secondsUntilReset: error.daily.secondsUntilReset,
        },
        { status: 429, headers: dailyHeaders(error.daily) },
      );
    }
    return NextResponse.json(
      { error: mapped.message ?? STUDY_TOOLS_PLAN_DENIED_MESSAGE },
      { status: mapped.status },
    );
  }
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
