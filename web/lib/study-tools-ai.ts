import 'server-only';

import { handleCueGeminiProxy, handleGroqProxy } from '@/lib/ai-proxy-server';
import {
  buildFileStudyPrompt,
  buildFlashcardPrompt,
  buildNumberedSourceText,
  buildQuizPrompt,
} from '@/lib/study-tools-prompts';
import {
  getStudyGeminiModel,
  getStudyGroqModel,
  hasGeminiApiKey,
  hasGroqApiKey,
  isStudyAiDev,
  logStudyAiFallback,
  logStudyAiFallbackResult,
  logStudyAiGenerationDiagnostics,
  logStudyAiOutcome,
  logStudyAiPreCall,
  logStudyAiProviderFailure,
  mapProxyErrorToUserMessage,
  mapStudyAiAggregateFailure,
  parseStudyToolsJson,
  STUDY_AI_USER_ERRORS,
  type StudyAiEndpoint,
} from '@/lib/study-tools-ai-utils';
import { prepareSourceForStudyAi, type PreparedStudySource } from '@/lib/study-tools-source-pipeline';
import { DIRECT_GENERATION_MAX_CHARS } from '@/lib/study-tools-text-limits';
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

type ProviderAttemptResult =
  | { ok: true; text: string; provider: 'groq' | 'gemini' }
  | { ok: false; provider: 'groq' | 'gemini'; status?: number; message: string; errorName?: string };

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

async function readProxyJson(
  response: Response,
): Promise<{ text?: string; error?: string; code?: string } | null> {
  return (await response.json().catch(() => null)) as {
    text?: string;
    error?: string;
    code?: string;
  } | null;
}

async function runStudyGroq(
  systemPrompt: string,
  numberedSource: string,
  meta: { endpoint: StudyAiEndpoint; sourceTextLength: number; count?: number; countLabel?: 'numQuestions' | 'numCards' },
): Promise<ProviderAttemptResult> {
  const model = getStudyGroqModel();
  logStudyAiPreCall({
    endpoint: meta.endpoint,
    uidExists: true,
    provider: 'groq',
    model,
    sourceTextLength: meta.sourceTextLength,
    count: meta.count,
    countLabel: meta.countLabel,
  });

  const response = await handleGroqProxy({
    model,
    temperature: 0.2,
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: numberedSource },
    ],
  });

  const json = await readProxyJson(response);
  if (!response.ok) {
    const message = mapProxyErrorToUserMessage('groq', response.status, json?.error);
    logStudyAiProviderFailure({
      provider: 'groq',
      status: response.status,
      message: json?.error ?? message,
      errorName: 'GroqProxyError',
    });
    return { ok: false, provider: 'groq', status: response.status, message, errorName: 'GroqProxyError' };
  }
  if (!json?.text?.trim()) {
    const message = STUDY_AI_USER_ERRORS.emptyResponse;
    logStudyAiProviderFailure({
      provider: 'groq',
      status: response.status,
      message,
      errorName: 'EmptyGroqResponse',
    });
    return { ok: false, provider: 'groq', status: response.status, message, errorName: 'EmptyGroqResponse' };
  }
  return { ok: true, text: json.text, provider: 'groq' };
}

async function runStudyGemini(
  systemPrompt: string,
  numberedSource: string,
  meta: { endpoint: StudyAiEndpoint; sourceTextLength: number; count?: number; countLabel?: 'numQuestions' | 'numCards' },
): Promise<ProviderAttemptResult> {
  const model = getStudyGeminiModel();
  logStudyAiPreCall({
    endpoint: meta.endpoint,
    uidExists: true,
    provider: 'gemini',
    model,
    sourceTextLength: meta.sourceTextLength,
    count: meta.count,
    countLabel: meta.countLabel,
  });

  const response = await handleCueGeminiProxy({
    systemInstruction: systemPrompt,
    history: [],
    latestUserMessage: {
      role: 'user',
      parts: [{ text: numberedSource }],
    },
    maxOutputTokens: 4096,
  });

  const json = await readProxyJson(response);
  if (!response.ok) {
    const message = mapProxyErrorToUserMessage('gemini', response.status, json?.error);
    logStudyAiProviderFailure({
      provider: 'gemini',
      status: response.status,
      message: json?.error ?? message,
      errorName: 'GeminiProxyError',
    });
    return {
      ok: false,
      provider: 'gemini',
      status: response.status,
      message,
      errorName: 'GeminiProxyError',
    };
  }
  if (!json?.text?.trim()) {
    const message = STUDY_AI_USER_ERRORS.emptyResponse;
    logStudyAiProviderFailure({
      provider: 'gemini',
      status: response.status,
      message,
      errorName: 'EmptyGeminiResponse',
    });
    return { ok: false, provider: 'gemini', status: response.status, message, errorName: 'EmptyGeminiResponse' };
  }
  return { ok: true, text: json.text, provider: 'gemini' };
}

async function runStudyAi(params: {
  systemPrompt: string;
  sourceText: string;
  endpoint: StudyAiEndpoint;
  count?: number;
  countLabel?: 'numQuestions' | 'numCards';
  userPlan?: string;
  prepared?: PreparedStudySource;
  originalSourceLength?: number;
  sourceType?: string;
  fileType?: string;
}): Promise<string> {
  const numbered = buildNumberedSourceText(truncateSource(params.sourceText));
  const meta = {
    endpoint: params.endpoint,
    sourceTextLength: params.originalSourceLength ?? params.sourceText.length,
    numberedSourceLength: numbered.length,
    count: params.count,
    countLabel: params.countLabel,
  };

  logStudyAiGenerationDiagnostics({
    endpoint: params.endpoint,
    sourceType: params.sourceType,
    fileType: params.fileType,
    extractedCharacterCount: meta.sourceTextLength,
    estimatedInputTokens: params.prepared?.estimatedInputTokens ?? Math.ceil(meta.sourceTextLength / 4),
    requestedCount: params.count,
    model: getStudyGroqModel(),
    wasChunked: params.prepared?.wasChunked ?? false,
    chunkCount: params.prepared?.chunkCount ?? 0,
  });

  if (isStudyAiDev()) {
    console.info('[study-tools-ai] source prepared', {
      endpoint: meta.endpoint,
      sourceTextLength: meta.sourceTextLength,
      numberedSourceLength: meta.numberedSourceLength,
      wasChunked: params.prepared?.wasChunked ?? false,
      chunkCount: params.prepared?.chunkCount ?? 0,
      ...(meta.countLabel && meta.count != null ? { [meta.countLabel]: meta.count } : {}),
    });
  }

  const groqAvailable = hasGroqApiKey();
  const geminiAvailable = hasGeminiApiKey();

  if (!groqAvailable && !geminiAvailable) {
    const message = STUDY_AI_USER_ERRORS.noProvider;
    logStudyAiOutcome({
      endpoint: params.endpoint,
      userPlan: params.userPlan,
      sourceTextLength: params.sourceText.length,
      numQuestions: params.countLabel === 'numQuestions' ? params.count : undefined,
      numCards: params.countLabel === 'numCards' ? params.count : undefined,
      fallbackAttempted: false,
      failureStage: 'no_provider_configured',
      userMessage: message,
    });
    throw new Error(message);
  }

  const failures: Array<{
    provider: 'groq' | 'gemini';
    status?: number;
    message: string;
    errorName?: string;
  }> = [];

  let fallbackAttempted = false;

  if (groqAvailable) {
    const groqResult = await runStudyGroq(params.systemPrompt, numbered, meta);
    if (groqResult.ok) return groqResult.text;
    failures.push(groqResult);
  }

  if (geminiAvailable) {
    if (groqAvailable && failures.length > 0) {
      fallbackAttempted = true;
      logStudyAiFallback();
    }
    const geminiResult = await runStudyGemini(params.systemPrompt, numbered, meta);
    logStudyAiFallbackResult({
      ok: geminiResult.ok,
      status: geminiResult.ok ? undefined : geminiResult.status,
    });
    if (geminiResult.ok) return geminiResult.text;
    failures.push(geminiResult);
  }

  const message = mapStudyAiAggregateFailure(failures);
  const failureStage =
    failures.length === 0
      ? 'no_provider_attempted'
      : failures.length === 1
        ? failures[0]!.provider === 'groq'
          ? 'groq_failed'
          : 'gemini_failed'
        : 'groq_and_gemini_failed';

  logStudyAiOutcome({
    endpoint: params.endpoint,
    userPlan: params.userPlan,
    sourceTextLength: params.sourceText.length,
    numQuestions: params.countLabel === 'numQuestions' ? params.count : undefined,
    numCards: params.countLabel === 'numCards' ? params.count : undefined,
    fallbackAttempted,
    failureStage,
    userMessage: message,
  });

  throw new Error(message);
}

export async function generateQuizFromText(
  text: string,
  numQuestions: number,
  options?: StudyAiGenerateOptions,
): Promise<QuizQuestion[]> {
  const originalLength = text.length;
  try {
    const prepared = await prepareForGeneration(text, options);
    const runOnce = (strictJson: boolean) =>
      runStudyAi({
        systemPrompt: `${buildQuizPrompt(numQuestions)}${strictJson ? STRICT_JSON_SUFFIX : ''}`,
        sourceText: prepared.text,
        endpoint: 'generate-quiz',
        count: numQuestions,
        countLabel: 'numQuestions',
        userPlan: options?.userPlan,
        prepared,
        originalSourceLength: originalLength,
        sourceType: options?.sourceType,
        fileType: options?.fileType,
      });

    let raw = await runOnce(false);
    let parsed: { quiz?: QuizQuestion[] };
    try {
      parsed = parseStudyToolsJson<{ quiz?: QuizQuestion[] }>(raw, 'quiz');
    } catch {
      raw = await runOnce(true);
      try {
        parsed = parseStudyToolsJson<{ quiz?: QuizQuestion[] }>(raw, 'quiz');
      } catch (error) {
        logStudyAiOutcome({
          endpoint: 'generate-quiz',
          userPlan: options?.userPlan,
          sourceTextLength: originalLength,
          numQuestions,
          fallbackAttempted: false,
          jsonParseSuccess: false,
          failureStage: 'json_parse_failed',
          userMessage: error instanceof Error ? error.message : STUDY_AI_USER_ERRORS.invalidQuiz,
        });
        throw error;
      }
    }
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
    if (
      error instanceof Error &&
      error.message === STUDY_AI_USER_ERRORS.invalidQuiz
    ) {
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
  const runOnce = (strictJson: boolean) =>
    runStudyAi({
      systemPrompt: `${buildFlashcardPrompt(numCards)}${strictJson ? STRICT_JSON_SUFFIX : ''}`,
      sourceText: prepared.text,
      endpoint: 'generate-flashcards',
      count: numCards,
      countLabel: 'numCards',
      userPlan: options?.userPlan,
      prepared,
      originalSourceLength: originalLength,
      sourceType: options?.sourceType,
      fileType: options?.fileType,
    });

  let raw = await runOnce(false);
  let parsed: { flashcards?: FlashcardItem[] };
  try {
    parsed = parseStudyToolsJson<{ flashcards?: FlashcardItem[] }>(raw, 'flashcards');
  } catch {
    raw = await runOnce(true);
    parsed = parseStudyToolsJson<{ flashcards?: FlashcardItem[] }>(raw, 'flashcards');
  }

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
