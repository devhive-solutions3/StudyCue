import 'server-only';

import {
  buildFileStudyPrompt,
  buildFlashcardPrompt,
  buildNumberedSourceText,
  buildQuizPrompt,
} from '@/lib/study-tools-prompts';
import {
  invalidFormatMessage,
  isStudyAiDev,
  logStudyAiGenerationDiagnostics,
  logStudyAiOutcome,
  parseStudyToolsJson,
  STUDY_AI_USER_ERRORS,
  type StudyAiEndpoint,
} from '@/lib/study-tools-ai-utils';
import { generateTextWithStudyToolProviders } from '@/lib/study-tools-provider-fallback';
import { prepareSourceForStudyAi, type PreparedStudySource } from '@/lib/study-tools-source-pipeline';
import { DIRECT_GENERATION_MAX_CHARS, isLargeStudySource } from '@/lib/study-tools-text-limits';
import { normalizeGeneratedFlashcards, normalizeGeneratedQuiz } from '@/lib/study-tools-storage';
import type { FileStudyResult, FlashcardItem, QuizQuestion } from '@/lib/study-tools-types';
import type { StudySourceType } from '@/lib/study-tools-types';

const STRICT_JSON_SUFFIX =
  '\n\nReturn ONLY valid JSON matching the schema. No markdown fences, no commentary.';

type StudyAiGenerateOptions = {
  userPlan?: string;
  sourceName?: string;
  sourceType?: StudySourceType;
  fileType?: string;
};

function truncateSource(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= DIRECT_GENERATION_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, DIRECT_GENERATION_MAX_CHARS)}\n\n[Source truncated for length.]`;
}

async function prepareForGeneration(
  text: string,
  options?: StudyAiGenerateOptions,
): Promise<PreparedStudySource> {
  return prepareSourceForStudyAi({
    rawText: text,
    sourceName: options?.sourceName,
    fileType: options?.fileType,
  });
}

async function runStudyAi(params: {
  systemPrompt: string;
  sourceText: string;
  endpoint: StudyAiEndpoint;
  toolType: 'quiz' | 'flashcards' | 'file_study';
  count?: number;
  countLabel?: 'numQuestions' | 'numCards';
  userPlan?: string;
  prepared?: PreparedStudySource;
  originalSourceLength?: number;
  sourceType?: string;
  fileType?: string;
}): Promise<string> {
  const numbered = buildNumberedSourceText(truncateSource(params.sourceText));
  const sourceTextLength = params.originalSourceLength ?? params.sourceText.length;

  logStudyAiGenerationDiagnostics({
    endpoint: params.endpoint,
    sourceType: params.sourceType,
    fileType: params.fileType,
    extractedCharacterCount: sourceTextLength,
    estimatedInputTokens: params.prepared?.estimatedInputTokens ?? Math.ceil(sourceTextLength / 4),
    requestedCount: params.count,
    model: 'multi-provider',
    wasChunked: params.prepared?.wasChunked ?? false,
    chunkCount: params.prepared?.chunkCount ?? 0,
  });

  if (isStudyAiDev()) {
    console.info('[study-tools-ai] source prepared', {
      endpoint: params.endpoint,
      sourceTextLength,
      numberedSourceLength: numbered.length,
      wasChunked: params.prepared?.wasChunked ?? false,
      chunkCount: params.prepared?.chunkCount ?? 0,
      wasLargeSource: isLargeStudySource(sourceTextLength),
      ...(params.countLabel && params.count != null ? { [params.countLabel]: params.count } : {}),
    });
  }

  const { text, provider, model, fallbackAttempted } = await generateTextWithStudyToolProviders({
    systemPrompt: params.systemPrompt,
    userContent: numbered,
    endpoint: params.endpoint,
    toolType: params.toolType,
    sourceTextLength,
    wasLargeSource: isLargeStudySource(sourceTextLength),
    wasChunked: params.prepared?.wasChunked ?? false,
    count: params.count,
    countLabel: params.countLabel,
  });

  if (isStudyAiDev()) {
    console.info('[study-tools-ai] provider success', {
      endpoint: params.endpoint,
      provider,
      model,
      fallbackAttempted,
    });
  }

  return text;
}

async function runStudyAiWithJsonRetry(params: {
  buildPrompt: (strictJson: boolean) => string;
  sourceText: string;
  endpoint: StudyAiEndpoint;
  toolType: 'quiz' | 'flashcards' | 'file_study';
  kind: 'quiz' | 'flashcards' | 'file-study';
  count?: number;
  countLabel?: 'numQuestions' | 'numCards';
  options?: StudyAiGenerateOptions;
  prepared: PreparedStudySource;
  originalSourceLength: number;
}): Promise<string> {
  let lastParseError: Error | null = null;
  const invalidMessage = invalidFormatMessage(params.kind);

  for (const strictJson of [false, true]) {
    try {
      const raw = await runStudyAi({
        systemPrompt: params.buildPrompt(strictJson),
        sourceText: params.prepared.text,
        endpoint: params.endpoint,
        toolType: params.toolType,
        count: params.count,
        countLabel: params.countLabel,
        userPlan: params.options?.userPlan,
        prepared: params.prepared,
        originalSourceLength: params.originalSourceLength,
        sourceType: params.options?.sourceType,
        fileType: params.options?.fileType,
      });
      parseStudyToolsJson(raw, params.kind);
      return raw;
    } catch (error) {
      if (error instanceof Error && error.message === invalidMessage) {
        lastParseError = error;
        continue;
      }
      throw error;
    }
  }

  throw lastParseError ?? new Error(invalidMessage);
}

export async function generateQuizFromText(
  text: string,
  numQuestions: number,
  options?: StudyAiGenerateOptions,
): Promise<QuizQuestion[]> {
  const originalLength = text.length;
  try {
    const prepared = await prepareForGeneration(text, options);
    const raw = await runStudyAiWithJsonRetry({
      buildPrompt: (strictJson) =>
        `${buildQuizPrompt(numQuestions)}${strictJson ? STRICT_JSON_SUFFIX : ''}`,
      sourceText: prepared.text,
      endpoint: 'generate-quiz',
      toolType: 'quiz',
      kind: 'quiz',
      count: numQuestions,
      countLabel: 'numQuestions',
      options,
      prepared,
      originalSourceLength: originalLength,
    });

    const parsed = parseStudyToolsJson<{ quiz?: QuizQuestion[] }>(raw, 'quiz');
    if (!Array.isArray(parsed.quiz) || parsed.quiz.length === 0) {
      throw new Error(STUDY_AI_USER_ERRORS.invalidQuiz);
    }
    const normalized = normalizeGeneratedQuiz(parsed.quiz);
    if (normalized.length === 0) {
      throw new Error(STUDY_AI_USER_ERRORS.invalidQuiz);
    }
    logStudyAiOutcome({
      endpoint: 'generate-quiz',
      userPlan: options?.userPlan,
      sourceTextLength: originalLength,
      numQuestions,
      fallbackAttempted: false,
      jsonParseSuccess: true,
    });
    return normalized.slice(0, numQuestions);
  } catch (error) {
    if (error instanceof Error && error.message === STUDY_AI_USER_ERRORS.invalidQuiz) {
      logStudyAiOutcome({
        endpoint: 'generate-quiz',
        userPlan: options?.userPlan,
        sourceTextLength: originalLength,
        numQuestions,
        fallbackAttempted: false,
        jsonParseSuccess: false,
        failureStage: 'schema_validation_failed',
        userMessage: error.message,
      });
    }
    throw error;
  }
}

export async function generateFlashcardsFromText(
  text: string,
  numCards: number,
  options?: StudyAiGenerateOptions,
): Promise<FlashcardItem[]> {
  const originalLength = text.length;
  const prepared = await prepareForGeneration(text, options);
  const raw = await runStudyAiWithJsonRetry({
    buildPrompt: (strictJson) =>
      `${buildFlashcardPrompt(numCards)}${strictJson ? STRICT_JSON_SUFFIX : ''}`,
    sourceText: prepared.text,
    endpoint: 'generate-flashcards',
    toolType: 'flashcards',
    kind: 'flashcards',
    count: numCards,
    countLabel: 'numCards',
    options,
    prepared,
    originalSourceLength: originalLength,
  });

  const parsed = parseStudyToolsJson<{ flashcards?: FlashcardItem[] }>(raw, 'flashcards');
  if (!Array.isArray(parsed.flashcards) || parsed.flashcards.length === 0) {
    throw new Error(STUDY_AI_USER_ERRORS.invalidFlashcards);
  }
  const normalized = normalizeGeneratedFlashcards(parsed.flashcards);
  if (normalized.length === 0) {
    throw new Error(STUDY_AI_USER_ERRORS.invalidFlashcards);
  }
  return normalized.slice(0, numCards);
}

export async function generateFileStudyFromText(
  text: string,
  options?: StudyAiGenerateOptions,
): Promise<FileStudyResult> {
  const originalLength = text.length;
  const prepared = await prepareForGeneration(text, options);
  const raw = await runStudyAi({
    systemPrompt: buildFileStudyPrompt(),
    sourceText: prepared.text,
    endpoint: 'file-study',
    toolType: 'file_study',
    userPlan: options?.userPlan,
    prepared,
    originalSourceLength: originalLength,
    sourceType: options?.sourceType,
    fileType: options?.fileType,
  });
  const parsed = parseStudyToolsJson<FileStudyResult>(raw, 'file-study');
  if (!parsed.summary?.trim()) {
    throw new Error(STUDY_AI_USER_ERRORS.invalidFileStudy);
  }
  return {
    summary: parsed.summary.trim(),
    keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints.map(String) : [],
    keyTerms: Array.isArray(parsed.keyTerms)
      ? parsed.keyTerms.map((row) => ({
          term: String((row as { term?: string }).term ?? ''),
          definition: String((row as { definition?: string }).definition ?? ''),
        }))
      : [],
    suggestedReviewQuestions: Array.isArray(parsed.suggestedReviewQuestions)
      ? parsed.suggestedReviewQuestions.map(String)
      : [],
  };
}
