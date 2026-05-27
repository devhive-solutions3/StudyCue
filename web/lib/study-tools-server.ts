import 'server-only';

import {
  generateFileStudyFromText,
  generateFlashcardsFromText,
  generateQuizFromText,
} from '@/lib/study-tools-ai';
import type { FileStudyResult } from '@/lib/study-tools-types';
import { assertPremiumStudyToolsAccess } from '@/lib/study-tools-access';
import { getStudyGroqModel, isStudyAiDev } from '@/lib/study-tools-ai-utils';
import { STUDY_TOOLS_PLAN_DENIED_MESSAGE } from '@/lib/study-tools-request';
import { logStudyToolGenerationEvent } from '@/lib/study-tools-generation-tracker';
import {
  readStudyToolsUsage,
  reserveStudyToolGeneration,
  type StudyToolKind,
  type StudyToolSourceSurface,
} from '@/lib/study-tools-usage-limits';
import {
  buildStudyToolUsageEstimates,
  logStudyToolAiUsage,
  studyToolFeatureFromEndpoint,
  type StudyToolEndpoint,
} from '@/lib/study-tools-usage-log';
import type { FlashcardItem, QuizQuestion, StudySourceType } from '@/lib/study-tools-types';
import { STUDY_SOURCE_MAX_CHARS, STUDY_SOURCE_MIN_CHARS } from '@/lib/study-tools-types';
import type { AnalyticsUserPlan } from '@/lib/analytics-types';

export type StudyToolsDailyUsage = {
  limit: number;
  used: number;
  resetAt: string;
  resetLabel?: string;
};

export class StudyToolsPlanDeniedError extends Error {
  readonly status = 403 as const;
  constructor(message = STUDY_TOOLS_PLAN_DENIED_MESSAGE) {
    super(message);
    this.name = 'StudyToolsPlanDeniedError';
  }
}

export class StudyToolsRateLimitError extends Error {
  readonly status = 429 as const;
  constructor(
    message: string,
    readonly daily: StudyToolsDailyUsage,
  ) {
    super(message);
    this.name = 'StudyToolsRateLimitError';
  }
}

export class StudyToolsValidationError extends Error {
  readonly status = 400 as const;
  constructor(message: string) {
    super(message);
    this.name = 'StudyToolsValidationError';
  }
}

function validateSourceText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new StudyToolsValidationError('Source text is required.');
  }
  if (trimmed.length < STUDY_SOURCE_MIN_CHARS) {
    throw new StudyToolsValidationError(
      `Source text must be at least ${STUDY_SOURCE_MIN_CHARS} characters.`,
    );
  }
  if (trimmed.length > STUDY_SOURCE_MAX_CHARS) {
    throw new StudyToolsValidationError(
      `Source text must be ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters or fewer.`,
    );
  }
  return trimmed;
}

function toAnalyticsPlan(plan: string): AnalyticsUserPlan {
  if (plan === 'beta' || plan === 'premium') return plan;
  return 'free';
}

function mapSourceType(sourceType: StudySourceType): StudySourceType | 'cue_attachment' {
  return sourceType;
}

async function ensureStudyToolsGeneration(params: {
  uid: string;
  email?: string | null;
  text: string;
  tool: StudyToolKind;
  sourceSurface: StudyToolSourceSurface;
  sourceType: StudySourceType;
  endpoint: StudyToolEndpoint;
  logEndpoint?: StudyToolEndpoint | '/api/cue';
  requestId?: string | null;
  itemCount: number;
}) {
  const access = await assertPremiumStudyToolsAccess(params.uid);
  const feature = studyToolFeatureFromEndpoint(params.endpoint);
  const userPlan = access.plan ?? 'free';
  const logEndpoint = params.logEndpoint ?? params.endpoint;
  const analyticsPlan = toAnalyticsPlan(userPlan);

  if (!access.allowed) {
    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'denied',
      userPlan,
      feature,
      endpoint: logEndpoint,
      errorCode: 'study_tools_plan_denied',
      ...buildStudyToolUsageEstimates({ provider: 'groq', sourceLength: 0 }),
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: analyticsPlan,
      tool: params.tool,
      sourceSurface: params.sourceSurface,
      sourceType: mapSourceType(params.sourceType),
      itemCount: params.itemCount,
      status: 'denied',
      endpoint: logEndpoint,
    }).catch(() => {});
    throw new StudyToolsPlanDeniedError(access.message ?? STUDY_TOOLS_PLAN_DENIED_MESSAGE);
  }

  const sourceText = validateSourceText(params.text);
  const usage = await reserveStudyToolGeneration({
    uid: params.uid,
    tool: params.tool,
    sourceSurface: params.sourceSurface,
    requestId: params.requestId ?? null,
  });

  if (!usage.allowed) {
    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'rate_limited',
      userPlan,
      feature,
      endpoint: logEndpoint,
      errorCode: 'study_tool_daily_limit',
      ...buildStudyToolUsageEstimates({ provider: 'groq', sourceLength: sourceText.length }),
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: analyticsPlan,
      tool: params.tool,
      sourceSurface: params.sourceSurface,
      sourceType: mapSourceType(params.sourceType),
      itemCount: params.itemCount,
      status: 'rate_limited',
      endpoint: logEndpoint,
    }).catch(() => {});
    throw new StudyToolsRateLimitError(usage.message, {
      limit: usage.daily.limit,
      used: usage.daily.used,
      resetAt: usage.daily.resetAt,
      resetLabel: usage.daily.resetLabel,
    });
  }

  if (isStudyAiDev()) {
    console.info('[study-tools-server] reserved', {
      endpoint: params.endpoint,
      tool: params.tool,
      sourceSurface: params.sourceSurface,
      uidExists: true,
      userPlan,
      sourceTextLength: sourceText.length,
      studyToolUsed: usage.daily.used,
      studyToolLimit: usage.daily.limit,
    });
  }

  return {
    sourceText,
    userPlan,
    analyticsPlan,
    feature,
    logEndpoint,
    daily: {
      limit: usage.daily.limit,
      used: usage.daily.used,
      resetAt: usage.daily.resetAt,
      resetLabel: usage.daily.resetLabel,
    },
    tool: params.tool,
    sourceSurface: params.sourceSurface,
    sourceType: params.sourceType,
    itemCount: params.itemCount,
  };
}

export async function getStudyToolsUsageForUser(uid: string) {
  const snapshot = await readStudyToolsUsage(uid);
  return {
    limit: snapshot.limit,
    used: snapshot.used,
    resetAt: snapshot.resetAt,
    resetLabel: snapshot.resetLabel,
    quizGenerationsUsed: snapshot.quizGenerationsUsed,
    flashcardGenerationsUsed: snapshot.flashcardGenerationsUsed,
    fileStudyGenerationsUsed: snapshot.fileStudyGenerationsUsed,
  };
}

export async function generateQuizForUser(params: {
  uid: string;
  email?: string | null;
  text: string;
  sourceName: string;
  sourceType: StudySourceType;
  numQuestions: number;
  endpoint?: StudyToolEndpoint;
  logEndpoint?: StudyToolEndpoint | '/api/cue';
  requestId?: string | null;
  sourceSurface?: StudyToolSourceSurface;
}): Promise<{ quiz: QuizQuestion[]; daily: StudyToolsDailyUsage }> {
  const endpoint = params.endpoint ?? '/api/study-tools/generate-quiz';
  const sourceSurface = params.sourceSurface ?? 'quiz_page';
  const ctx = await ensureStudyToolsGeneration({
    uid: params.uid,
    email: params.email,
    text: params.text,
    tool: 'quiz',
    sourceSurface,
    sourceType: params.sourceType,
    endpoint,
    logEndpoint: params.logEndpoint,
    requestId: params.requestId,
    itemCount: params.numQuestions,
  });

  try {
    const quiz = await generateQuizFromText(ctx.sourceText, params.numQuestions);
    const estimates = buildStudyToolUsageEstimates({
      provider: 'groq',
      sourceLength: ctx.sourceText.length,
      outputChars: JSON.stringify({ quiz }).length,
    });

    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'success',
      userPlan: ctx.userPlan,
      feature: ctx.feature,
      endpoint: ctx.logEndpoint,
      ...estimates,
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: ctx.analyticsPlan,
      tool: 'quiz',
      sourceSurface: ctx.sourceSurface,
      sourceType: mapSourceType(ctx.sourceType),
      itemCount: params.numQuestions,
      status: 'success',
      endpoint: ctx.logEndpoint,
    }).catch(() => {});

    return { quiz, daily: ctx.daily };
  } catch (error) {
    const estimates = buildStudyToolUsageEstimates({
      provider: 'groq',
      sourceLength: ctx.sourceText.length,
    });
    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'error',
      userPlan: ctx.userPlan,
      feature: ctx.feature,
      endpoint: ctx.logEndpoint,
      errorCode: 'generation_failed',
      ...estimates,
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: ctx.analyticsPlan,
      tool: 'quiz',
      sourceSurface: ctx.sourceSurface,
      sourceType: mapSourceType(ctx.sourceType),
      itemCount: params.numQuestions,
      status: 'error',
      endpoint: ctx.logEndpoint,
    }).catch(() => {});
    throw error;
  }
}

export async function generateFileStudyForUser(params: {
  uid: string;
  email?: string | null;
  text: string;
  sourceName: string;
  sourceType: StudySourceType;
  requestId?: string | null;
  sourceSurface?: StudyToolSourceSurface;
}): Promise<{ result: FileStudyResult; daily: StudyToolsDailyUsage }> {
  const endpoint = '/api/study-tools/file-study' as const;
  const sourceSurface = params.sourceSurface ?? 'notes';
  const ctx = await ensureStudyToolsGeneration({
    uid: params.uid,
    email: params.email,
    text: params.text,
    tool: 'file_study',
    sourceSurface,
    sourceType: params.sourceType,
    endpoint,
    requestId: params.requestId,
    itemCount: 1,
  });

  try {
    const result = await generateFileStudyFromText(ctx.sourceText);
    const estimates = buildStudyToolUsageEstimates({
      provider: 'groq',
      sourceLength: ctx.sourceText.length,
      outputChars: JSON.stringify(result).length,
    });

    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'success',
      userPlan: ctx.userPlan,
      feature: ctx.feature,
      endpoint: ctx.logEndpoint,
      ...estimates,
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: ctx.analyticsPlan,
      tool: 'file_study',
      sourceSurface: ctx.sourceSurface,
      sourceType: mapSourceType(ctx.sourceType),
      itemCount: 1,
      status: 'success',
      endpoint: ctx.logEndpoint,
    }).catch(() => {});

    return { result, daily: ctx.daily };
  } catch (error) {
    const estimates = buildStudyToolUsageEstimates({
      provider: 'groq',
      sourceLength: ctx.sourceText.length,
    });
    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'error',
      userPlan: ctx.userPlan,
      feature: ctx.feature,
      endpoint: ctx.logEndpoint,
      errorCode: 'generation_failed',
      ...estimates,
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: ctx.analyticsPlan,
      tool: 'file_study',
      sourceSurface: ctx.sourceSurface,
      sourceType: mapSourceType(ctx.sourceType),
      itemCount: 1,
      status: 'error',
      endpoint: ctx.logEndpoint,
    }).catch(() => {});
    throw error;
  }
}

export async function generateFlashcardsForUser(params: {
  uid: string;
  email?: string | null;
  text: string;
  sourceName: string;
  sourceType: StudySourceType;
  numCards: number;
  endpoint?: StudyToolEndpoint;
  logEndpoint?: StudyToolEndpoint | '/api/cue';
  requestId?: string | null;
  sourceSurface?: StudyToolSourceSurface;
}): Promise<{ flashcards: FlashcardItem[]; daily: StudyToolsDailyUsage }> {
  const endpoint = params.endpoint ?? '/api/study-tools/generate-flashcards';
  const sourceSurface = params.sourceSurface ?? 'flashcards_page';
  const ctx = await ensureStudyToolsGeneration({
    uid: params.uid,
    email: params.email,
    text: params.text,
    tool: 'flashcards',
    sourceSurface,
    sourceType: params.sourceType,
    endpoint,
    logEndpoint: params.logEndpoint,
    requestId: params.requestId,
    itemCount: params.numCards,
  });

  try {
    const flashcards = await generateFlashcardsFromText(ctx.sourceText, params.numCards);
    const estimates = buildStudyToolUsageEstimates({
      provider: 'groq',
      sourceLength: ctx.sourceText.length,
      outputChars: JSON.stringify({ flashcards }).length,
    });

    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'success',
      userPlan: ctx.userPlan,
      feature: ctx.feature,
      endpoint: ctx.logEndpoint,
      ...estimates,
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: ctx.analyticsPlan,
      tool: 'flashcards',
      sourceSurface: ctx.sourceSurface,
      sourceType: mapSourceType(ctx.sourceType),
      itemCount: params.numCards,
      status: 'success',
      endpoint: ctx.logEndpoint,
    }).catch(() => {});

    return { flashcards, daily: ctx.daily };
  } catch (error) {
    const estimates = buildStudyToolUsageEstimates({
      provider: 'groq',
      sourceLength: ctx.sourceText.length,
    });
    void logStudyToolAiUsage({
      uid: params.uid,
      email: params.email,
      authenticated: true,
      provider: 'groq',
      model: getStudyGroqModel(),
      status: 'error',
      userPlan: ctx.userPlan,
      feature: ctx.feature,
      endpoint: ctx.logEndpoint,
      errorCode: 'generation_failed',
      ...estimates,
    }).catch(() => {});
    void logStudyToolGenerationEvent({
      uid: params.uid,
      userPlan: ctx.analyticsPlan,
      tool: 'flashcards',
      sourceSurface: ctx.sourceSurface,
      sourceType: mapSourceType(ctx.sourceType),
      itemCount: params.numCards,
      status: 'error',
      endpoint: ctx.logEndpoint,
    }).catch(() => {});
    throw error;
  }
}
