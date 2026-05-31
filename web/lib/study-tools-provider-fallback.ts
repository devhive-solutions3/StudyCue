import 'server-only';

import { handleCueGeminiProxy, handleGroqProxy } from '@/lib/ai-proxy-server';
import {
  getStudyGeminiModel,
  getStudyGroqModel,
  hasGeminiApiKey,
  hasGroqApiKey,
  isStudyAiDev,
  logStudyAiPreCall,
  logStudyAiProviderFailure,
  sanitizeProviderErrorMessage,
  type StudyAiEndpoint,
} from '@/lib/study-tools-ai-utils';

export type StudyToolProvider = 'groq' | 'gemini';

export type StudyProviderErrorCategory =
  | 'quota_exceeded'
  | 'rate_limited'
  | 'timeout'
  | 'provider_unavailable'
  | 'invalid_model'
  | 'invalid_json'
  | 'auth_error'
  | 'empty_response'
  | 'unknown';

export type StudyProviderError = {
  provider: StudyToolProvider;
  model: string;
  code?: string;
  category: StudyProviderErrorCategory;
  message: string;
  retryAt?: string;
  rawStatus?: number;
};

export type StudyProviderAttemptLog = {
  provider: StudyToolProvider;
  model: string;
  result: 'success' | 'failure';
  category?: StudyProviderErrorCategory;
};

const FALLBACK_ELIGIBLE: ReadonlySet<StudyProviderErrorCategory> = new Set([
  'quota_exceeded',
  'rate_limited',
  'timeout',
  'provider_unavailable',
  'invalid_model',
  'empty_response',
  'unknown',
]);

export const STUDY_PROVIDER_USER_ERRORS = {
  allRateLimited: 'All AI providers are currently rate-limited. Please try again later.',
  providerQuotaUnknown: 'AI provider quota was reached. Please try again later.',
  noProvider: 'AI provider is not configured.',
  timeout: 'AI generation timed out. Try fewer questions/cards or a shorter file.',
  largeSourceFailed:
    'This file is too large to process right now. Try fewer questions/cards or split the file.',
} as const;

export function getStudyToolsProviderOrder(): StudyToolProvider[] {
  const raw = process.env.STUDY_TOOLS_PROVIDER_ORDER?.trim();
  const parsed = (raw ? raw.split(',') : ['groq', 'gemini'])
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is StudyToolProvider => value === 'groq' || value === 'gemini');

  const seen = new Set<StudyToolProvider>();
  const order: StudyToolProvider[] = [];
  for (const provider of parsed) {
    if (!seen.has(provider)) {
      seen.add(provider);
      order.push(provider);
    }
  }
  return order.length > 0 ? order : ['groq', 'gemini'];
}

export function isStudyProviderConfigured(provider: StudyToolProvider): boolean {
  return provider === 'groq' ? hasGroqApiKey() : hasGeminiApiKey();
}

export function getConfiguredStudyProviders(): StudyToolProvider[] {
  return getStudyToolsProviderOrder().filter(isStudyProviderConfigured);
}

function parseRetryAtFromMessage(message: string): string | undefined {
  const retryInSeconds = message.match(/retry in ([\d.]+)\s*s/i);
  if (retryInSeconds?.[1]) {
    const seconds = Number.parseFloat(retryInSeconds[1]);
    if (Number.isFinite(seconds) && seconds > 0) {
      return new Date(Date.now() + seconds * 1000).toISOString();
    }
  }
  const retryAtIso = message.match(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/);
  if (retryAtIso?.[0]) return retryAtIso[0];
  return undefined;
}

function classifyProxyError(
  provider: StudyToolProvider,
  status: number,
  proxyError?: string,
  code?: string,
): StudyProviderError {
  const model = provider === 'groq' ? getStudyGroqModel() : getStudyGeminiModel();
  const err = sanitizeProviderErrorMessage(proxyError?.trim() ?? '');
  const retryAt = parseRetryAtFromMessage(err);

  let category: StudyProviderErrorCategory = 'unknown';
  let message = err || 'AI request failed.';

  if (/timeout|timed out|ETIMEDOUT|deadline exceeded/i.test(err)) {
    category = 'timeout';
    message = STUDY_PROVIDER_USER_ERRORS.timeout;
  } else if (status === 500 && /Missing GROQ_API_KEY/i.test(err)) {
    category = 'auth_error';
    message = STUDY_PROVIDER_USER_ERRORS.noProvider;
  } else if (status === 500 && /Missing GEMINI_API_KEY/i.test(err)) {
    category = 'auth_error';
    message = STUDY_PROVIDER_USER_ERRORS.noProvider;
  } else if (status === 429) {
    if (/quota|billing|exceeded/i.test(err)) {
      category = 'quota_exceeded';
      message = STUDY_PROVIDER_USER_ERRORS.providerQuotaUnknown;
    } else {
      category = 'rate_limited';
      message = STUDY_PROVIDER_USER_ERRORS.allRateLimited;
    }
  } else if (provider === 'groq' && (status === 401 || /invalid.*api key/i.test(err))) {
    category = 'auth_error';
    message = 'Groq API key is missing or invalid. Check GROQ_API_KEY.';
  } else if (provider === 'gemini' && /API key|permission|unauthorized|401|403/i.test(err)) {
    category = 'auth_error';
    message = 'Gemini API key is missing or invalid. Check GEMINI_API_KEY.';
  } else if (/model|decommission|not found/i.test(err)) {
    category = 'invalid_model';
    message =
      provider === 'groq'
        ? 'Groq model failed or is unavailable. Check the configured model.'
        : 'Gemini model failed or is unavailable. Check GEMINI_MODEL.';
  } else if (/empty/i.test(err)) {
    category = 'empty_response';
    message = 'AI returned an empty response.';
  } else if (status >= 500 || /unavailable|upstream/i.test(err)) {
    category = 'provider_unavailable';
    message = STUDY_PROVIDER_USER_ERRORS.allRateLimited;
  }

  return {
    provider,
    model,
    code,
    category,
    message,
    retryAt,
    rawStatus: status,
  };
}

export function isStudyProviderFallbackEligible(category: StudyProviderErrorCategory): boolean {
  return FALLBACK_ELIGIBLE.has(category);
}

export function formatProviderRetryLabel(retryAtIso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(retryAtIso));
  } catch {
    return 'later';
  }
}

export function studyProviderFailuresUserMessage(failures: StudyProviderError[]): string {
  if (failures.length === 0) {
    return STUDY_PROVIDER_USER_ERRORS.allRateLimited;
  }

  if (failures.every((row) => row.category === 'auth_error')) {
    const missingAll = failures.every((row) => /not configured|Missing/i.test(row.message));
    if (missingAll) return STUDY_PROVIDER_USER_ERRORS.noProvider;
  }

  const withRetry = failures
    .map((row) => row.retryAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (withRetry.length > 0) {
    const label = formatProviderRetryLabel(withRetry[0]!);
    return `AI quota reached. Refreshes at ${label}.`;
  }

  const quotaOrRate = failures.filter(
    (row) => row.category === 'quota_exceeded' || row.category === 'rate_limited',
  );
  if (quotaOrRate.length === failures.length) {
    return STUDY_PROVIDER_USER_ERRORS.allRateLimited;
  }

  if (failures.every((row) => row.category === 'timeout')) {
    return STUDY_PROVIDER_USER_ERRORS.timeout;
  }

  if (failures.length === 1) {
    const only = failures[0]!;
    if (only.category === 'quota_exceeded' || only.category === 'rate_limited') {
      return STUDY_PROVIDER_USER_ERRORS.providerQuotaUnknown;
    }
    return only.message;
  }

  return STUDY_PROVIDER_USER_ERRORS.allRateLimited;
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

async function callGroqProvider(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens: number,
): Promise<{ ok: true; text: string } | { ok: false; error: StudyProviderError }> {
  const model = getStudyGroqModel();
  const response = await handleGroqProxy({
    model,
    temperature: 0.2,
    max_tokens: maxOutputTokens,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  });
  const json = await readProxyJson(response);
  if (!response.ok) {
    return {
      ok: false,
      error: classifyProxyError('groq', response.status, json?.error, json?.code),
    };
  }
  const text = json?.text?.trim();
  if (!text) {
    return {
      ok: false,
      error: classifyProxyError('groq', response.status ?? 502, 'Groq response was empty.'),
    };
  }
  return { ok: true, text };
}

async function callGeminiProvider(
  systemPrompt: string,
  userContent: string,
  maxOutputTokens: number,
): Promise<{ ok: true; text: string } | { ok: false; error: StudyProviderError }> {
  const response = await handleCueGeminiProxy({
    systemInstruction: systemPrompt,
    history: [],
    latestUserMessage: { role: 'user', parts: [{ text: userContent }] },
    maxOutputTokens,
  });
  const json = await readProxyJson(response);
  if (!response.ok) {
    return {
      ok: false,
      error: classifyProxyError('gemini', response.status, json?.error, json?.code),
    };
  }
  const text = json?.text?.trim();
  if (!text) {
    return {
      ok: false,
      error: classifyProxyError('gemini', response.status ?? 502, 'AI response was empty.'),
    };
  }
  return { ok: true, text };
}

export function logStudyProviderAttemptChain(params: {
  endpoint: StudyAiEndpoint;
  toolType?: 'quiz' | 'flashcards' | 'file_study';
  textLength: number;
  wasLargeSource?: boolean;
  wasChunked?: boolean;
  providerAttemptOrder: StudyToolProvider[];
  attempts: StudyProviderAttemptLog[];
  fallbackAttempted: boolean;
  finalProvider?: StudyToolProvider;
  finalModel?: string;
}): void {
  if (!isStudyAiDev()) return;
  console.info('[study-tools-provider] attempt chain', {
    endpoint: params.endpoint,
    toolType: params.toolType,
    textLength: params.textLength,
    wasLargeSource: params.wasLargeSource ?? false,
    wasChunked: params.wasChunked ?? false,
    providerAttemptOrder: params.providerAttemptOrder,
    attempts: params.attempts,
    fallbackAttempted: params.fallbackAttempted,
    finalProvider: params.finalProvider,
    finalModel: params.finalModel,
  });
}

export async function generateTextWithStudyToolProviders(params: {
  systemPrompt: string;
  userContent: string;
  endpoint: StudyAiEndpoint;
  maxOutputTokens?: number;
  toolType?: 'quiz' | 'flashcards' | 'file_study';
  sourceTextLength?: number;
  wasLargeSource?: boolean;
  wasChunked?: boolean;
  count?: number;
  countLabel?: 'numQuestions' | 'numCards';
}): Promise<{
  text: string;
  provider: StudyToolProvider;
  model: string;
  fallbackAttempted: boolean;
}> {
  const maxOutputTokens = params.maxOutputTokens ?? 4096;
  const providers = getConfiguredStudyProviders();

  if (providers.length === 0) {
    throw new Error(STUDY_PROVIDER_USER_ERRORS.noProvider);
  }

  const failures: StudyProviderError[] = [];
  const attempts: StudyProviderAttemptLog[] = [];
  let fallbackAttempted = false;

  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index]!;
    const model = provider === 'groq' ? getStudyGroqModel() : getStudyGeminiModel();

    if (index > 0) fallbackAttempted = true;

    logStudyAiPreCall({
      endpoint: params.endpoint,
      uidExists: true,
      provider,
      model,
      sourceTextLength: params.sourceTextLength ?? params.userContent.length,
      count: params.count,
      countLabel: params.countLabel,
    });

    const result =
      provider === 'groq'
        ? await callGroqProvider(params.systemPrompt, params.userContent, maxOutputTokens)
        : await callGeminiProvider(params.systemPrompt, params.userContent, maxOutputTokens);

    if (result.ok) {
      attempts.push({ provider, model, result: 'success' });
      logStudyProviderAttemptChain({
        endpoint: params.endpoint,
        toolType: params.toolType,
        textLength: params.sourceTextLength ?? params.userContent.length,
        wasLargeSource: params.wasLargeSource,
        wasChunked: params.wasChunked,
        providerAttemptOrder: providers,
        attempts,
        fallbackAttempted,
        finalProvider: provider,
        finalModel: model,
      });
      return { text: result.text, provider, model, fallbackAttempted };
    }

    failures.push(result.error);
    attempts.push({
      provider,
      model,
      result: 'failure',
      category: result.error.category,
    });
    logStudyAiProviderFailure({
      provider,
      status: result.error.rawStatus,
      message: result.error.message,
      errorName: result.error.category,
    });

    if (!isStudyProviderFallbackEligible(result.error.category)) {
      break;
    }
  }

  logStudyProviderAttemptChain({
    endpoint: params.endpoint,
    toolType: params.toolType,
    textLength: params.sourceTextLength ?? params.userContent.length,
    wasLargeSource: params.wasLargeSource,
    wasChunked: params.wasChunked,
    providerAttemptOrder: providers,
    attempts,
    fallbackAttempted,
  });

  throw new Error(studyProviderFailuresUserMessage(failures));
}
