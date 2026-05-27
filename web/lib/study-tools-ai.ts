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
  logStudyAiFallback,
  logStudyAiFallbackResult,
  logStudyAiPreCall,
  logStudyAiProviderFailure,
  mapProxyErrorToUserMessage,
  mapStudyAiAggregateFailure,
  parseStudyToolsJson,
  STUDY_AI_USER_ERRORS,
  type StudyAiEndpoint,
} from '@/lib/study-tools-ai-utils';
import { normalizeGeneratedFlashcards, normalizeGeneratedQuiz } from '@/lib/study-tools-storage';
import type { FileStudyResult, FlashcardItem, QuizQuestion } from '@/lib/study-tools-types';
import { STUDY_SOURCE_MAX_CHARS } from '@/lib/study-tools-types';

type ProviderAttemptResult =
  | { ok: true; text: string; provider: 'groq' | 'gemini' }
  | { ok: false; provider: 'groq' | 'gemini'; status?: number; message: string; errorName?: string };

function truncateSource(text: string): string {
  const trimmed = text.trim();
  if (trimmed.length <= STUDY_SOURCE_MAX_CHARS) return trimmed;
  return `${trimmed.slice(0, STUDY_SOURCE_MAX_CHARS)}\n\n[Source truncated for length.]`;
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
}): Promise<string> {
  const numbered = buildNumberedSourceText(truncateSource(params.sourceText));
  const meta = {
    endpoint: params.endpoint,
    sourceTextLength: params.sourceText.length,
    count: params.count,
    countLabel: params.countLabel,
  };

  const groqAvailable = hasGroqApiKey();
  const geminiAvailable = hasGeminiApiKey();

  if (!groqAvailable && !geminiAvailable) {
    throw new Error(STUDY_AI_USER_ERRORS.noProvider);
  }

  const failures: Array<{
    provider: 'groq' | 'gemini';
    status?: number;
    message: string;
    errorName?: string;
  }> = [];

  if (groqAvailable) {
    const groqResult = await runStudyGroq(params.systemPrompt, numbered, meta);
    if (groqResult.ok) return groqResult.text;
    failures.push(groqResult);
  }

  if (geminiAvailable) {
    if (groqAvailable && failures.length > 0) {
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

  throw new Error(mapStudyAiAggregateFailure(failures));
}

export async function generateQuizFromText(
  text: string,
  numQuestions: number,
): Promise<QuizQuestion[]> {
  const raw = await runStudyAi({
    systemPrompt: buildQuizPrompt(numQuestions),
    sourceText: text,
    endpoint: 'generate-quiz',
    count: numQuestions,
    countLabel: 'numQuestions',
  });
  const parsed = parseStudyToolsJson<{ quiz?: QuizQuestion[] }>(raw, 'quiz');
  if (!Array.isArray(parsed.quiz) || parsed.quiz.length === 0) {
    throw new Error(STUDY_AI_USER_ERRORS.invalidQuiz);
  }
  const normalized = normalizeGeneratedQuiz(parsed.quiz);
  if (normalized.length === 0) {
    throw new Error(STUDY_AI_USER_ERRORS.invalidQuiz);
  }
  return normalized.slice(0, numQuestions);
}

export async function generateFlashcardsFromText(
  text: string,
  numCards: number,
): Promise<FlashcardItem[]> {
  const raw = await runStudyAi({
    systemPrompt: buildFlashcardPrompt(numCards),
    sourceText: text,
    endpoint: 'generate-flashcards',
    count: numCards,
    countLabel: 'numCards',
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

export async function generateFileStudyFromText(text: string): Promise<FileStudyResult> {
  const raw = await runStudyAi({
    systemPrompt: buildFileStudyPrompt(),
    sourceText: text,
    endpoint: 'file-study',
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
