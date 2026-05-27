import 'server-only';

import type { AnalyticsFeature } from '@/lib/analytics-types';
import { planFromProfile } from '@/lib/analytics-tracker';
import {
  estimateUsdCost,
  logCueUsage,
  DEFAULT_USD_TO_PHP,
  type CueUsageLogParams,
} from '@/lib/ai-usage-logger';
import type { UserPlan } from '@/lib/user-plan';

export type StudyToolEndpoint =
  | '/api/study-tools/generate-quiz'
  | '/api/study-tools/generate-flashcards'
  | '/api/study-tools/file-study';

export function studyToolFeatureFromEndpoint(endpoint: StudyToolEndpoint): AnalyticsFeature {
  if (endpoint === '/api/study-tools/generate-quiz') return 'quiz_generator';
  if (endpoint === '/api/study-tools/generate-flashcards') return 'flashcards';
  return 'file_study';
}

export function buildStudyToolSafeUsagePayload(params: {
  endpoint: StudyToolEndpoint;
  sourceLength: number;
  numQuestions?: number;
  numCards?: number;
}) {
  return {
    endpoint: params.endpoint,
    sourceLength: params.sourceLength,
    ...(params.numQuestions != null ? { numQuestions: params.numQuestions } : {}),
    ...(params.numCards != null ? { numCards: params.numCards } : {}),
  };
}

export function buildStudyToolUsageEstimates(params: {
  provider: 'groq' | 'gemini';
  sourceLength: number;
  outputChars?: number;
}) {
  const inputTokensEstimate = Math.max(1, Math.ceil(params.sourceLength / 4));
  const outputTokensEstimate = params.outputChars
    ? Math.max(1, Math.ceil(params.outputChars / 4))
    : 0;
  const totalTokensEstimate = inputTokensEstimate + outputTokensEstimate;
  const estimatedCostUsd = estimateUsdCost({
    provider: params.provider,
    inputTokens: inputTokensEstimate,
    outputTokens: outputTokensEstimate,
  });
  return {
    inputTokensEstimate,
    outputTokensEstimate,
    totalTokensEstimate,
    estimatedCostUsd,
    estimatedCostPhp: estimatedCostUsd * DEFAULT_USD_TO_PHP,
  };
}

export async function logStudyToolAiUsage(
  params: Omit<CueUsageLogParams, 'feature' | 'userPlan'> & {
    feature: AnalyticsFeature;
    userPlan: UserPlan;
    endpoint: CueUsageLogParams['endpoint'];
    profile?: Record<string, unknown> | null;
  },
) {
  return logCueUsage({
    ...params,
    userPlan: params.userPlan,
    feature: params.feature,
  });
}

export function resolveStudyToolUserPlan(
  profile: Record<string, unknown> | null | undefined,
): UserPlan {
  return planFromProfile(profile ?? null) as UserPlan;
}
