import 'server-only';

export type StudyAiEndpoint = 'generate-quiz' | 'generate-flashcards' | 'file-study';
export type StudyAiKind = 'quiz' | 'flashcards' | 'file-study';

export const STUDY_AI_USER_ERRORS = {
  noProvider: 'AI provider is not configured.',
  providerUnavailable:
    'AI provider is unavailable right now. Please try again.',
  groqModel:
    'Groq model failed or is unavailable. Check the configured model.',
  invalidQuiz: 'AI returned an invalid quiz format. Please try again.',
  invalidFlashcards: 'AI returned an invalid flashcards format. Please try again.',
  invalidFileStudy: 'AI returned an invalid study format. Please try again.',
  allProvidersFailed:
    'AI generation failed. Please try again in a few minutes.',
  timeout:
    'AI generation timed out. Try fewer questions/cards or a shorter file.',
  emptyResponse: 'AI returned an empty response.',
} as const;

export function isStudyAiDev(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function hasGroqApiKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY?.trim());
}

export function hasGeminiApiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

export function getStudyGroqModel(): string {
  return process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
}

export function getStudyGeminiModel(): string {
  return process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
}

export function sanitizeProviderErrorMessage(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/key=[^&\s]+/gi, 'key=[redacted]')
    .trim()
    .slice(0, 300);
}

type ProviderFailure = {
  provider: 'groq' | 'gemini';
  status?: number;
  errorName?: string;
  message: string;
};

export function mapProxyErrorToUserMessage(
  provider: 'groq' | 'gemini',
  status: number,
  proxyError?: string,
): string {
  const err = proxyError?.trim() ?? '';

  if (/timeout|timed out|ETIMEDOUT|deadline exceeded/i.test(err)) {
    return STUDY_AI_USER_ERRORS.timeout;
  }

  if (status === 500 && /Missing GROQ_API_KEY/i.test(err)) {
    return STUDY_AI_USER_ERRORS.noProvider;
  }
  if (status === 500 && /Missing GEMINI_API_KEY/i.test(err)) {
    return STUDY_AI_USER_ERRORS.noProvider;
  }
  if (status === 429) {
    if (/quota|billing|exceeded/i.test(err)) {
      return STUDY_AI_USER_ERRORS.providerUnavailable;
    }
    return provider === 'groq'
      ? 'Groq rate limit hit. Please try again shortly.'
      : STUDY_AI_USER_ERRORS.providerUnavailable;
  }
  if (provider === 'groq') {
    if (status === 401 || /invalid.*api key/i.test(err)) {
      return 'Groq API key is missing or invalid. Check GROQ_API_KEY.';
    }
    if (status === 502 && /empty/i.test(err)) {
      return STUDY_AI_USER_ERRORS.emptyResponse;
    }
    if (/model|decommission|not found/i.test(err)) {
      return STUDY_AI_USER_ERRORS.groqModel;
    }
    if (status === 502 && /Upstream Groq/i.test(err)) {
      return STUDY_AI_USER_ERRORS.groqModel;
    }
  }
  if (provider === 'gemini') {
    if (/model|not found|invalid/i.test(err)) {
      return 'Gemini model failed or is unavailable. Check GEMINI_MODEL.';
    }
    if (/API key|permission|unauthorized|401|403/i.test(err)) {
      return 'Gemini API key is missing or invalid. Check GEMINI_API_KEY.';
    }
  }
  if (/Upstream AI request failed/i.test(err)) {
    return STUDY_AI_USER_ERRORS.allProvidersFailed;
  }
  if (/Upstream Groq request failed/i.test(err)) {
    return STUDY_AI_USER_ERRORS.groqModel;
  }
  return err || STUDY_AI_USER_ERRORS.allProvidersFailed;
}

function isProviderUnavailableMessage(message: string): boolean {
  return /quota|billing|rate limit|exceeded|unavailable/i.test(message);
}

export function mapStudyAiAggregateFailure(failures: ProviderFailure[]): string {
  if (failures.length === 0) {
    return STUDY_AI_USER_ERRORS.allProvidersFailed;
  }

  const missingKey = failures.every(
    (row) => row.status === 500 && /Missing .*_API_KEY/i.test(row.message),
  );
  if (missingKey) {
    return STUDY_AI_USER_ERRORS.noProvider;
  }

  const mapped = failures.map((row) =>
    mapProxyErrorToUserMessage(row.provider, row.status ?? 502, row.message),
  );

  const unavailable = mapped.filter((message) => isProviderUnavailableMessage(message));
  if (unavailable.length > 0) {
    return STUDY_AI_USER_ERRORS.providerUnavailable;
  }

  const groqOnly = failures.length === 1 && failures[0]?.provider === 'groq';
  if (groqOnly) {
    return mapped[0]!;
  }

  const geminiOnly = failures.length === 1 && failures[0]?.provider === 'gemini';
  if (geminiOnly) {
    return mapped[0]!;
  }

  const keyErrors = mapped.filter((message) =>
    /API key is missing or invalid|not configured/i.test(message),
  );
  if (keyErrors.length === failures.length) {
    return keyErrors[0]!;
  }

  const modelErrors = mapped.filter((message) => /model failed|unavailable/i.test(message));
  if (modelErrors.length > 0 && keyErrors.length === 0) {
    return modelErrors[0]!;
  }

  if (keyErrors.length > 0) {
    return keyErrors[0]!;
  }

  return mapped[mapped.length - 1] ?? STUDY_AI_USER_ERRORS.allProvidersFailed;
}

export function invalidFormatMessage(kind: StudyAiKind): string {
  if (kind === 'quiz') return STUDY_AI_USER_ERRORS.invalidQuiz;
  if (kind === 'flashcards') return STUDY_AI_USER_ERRORS.invalidFlashcards;
  return STUDY_AI_USER_ERRORS.invalidFileStudy;
}

export function logStudyAiPreCall(params: {
  endpoint: StudyAiEndpoint;
  uidExists: boolean;
  plan?: string;
  provider: 'groq' | 'gemini';
  model: string;
  sourceTextLength: number;
  count?: number;
  countLabel?: 'numQuestions' | 'numCards';
}): void {
  if (!isStudyAiDev()) return;
  console.info('[study-tools-ai] pre-call', {
    endpoint: params.endpoint,
    uidExists: params.uidExists,
    userPlan: params.plan ?? 'unknown',
    provider: params.provider,
    providerAttempted: params.provider,
    model: params.model,
    groqModel: getStudyGroqModel(),
    geminiModel: getStudyGeminiModel(),
    sourceTextLength: params.sourceTextLength,
    ...(params.countLabel && params.count != null
      ? { [params.countLabel]: params.count }
      : {}),
    hasGroqKey: hasGroqApiKey(),
    hasGeminiKey: hasGeminiApiKey(),
  });
}

export function logStudyAiProviderFailure(params: {
  provider: 'groq' | 'gemini';
  errorName?: string;
  status?: number;
  message: string;
}): void {
  if (!isStudyAiDev()) return;
  console.warn('[study-tools-ai] provider failure', {
    provider: params.provider,
    errorName: params.errorName ?? 'Error',
    status: params.status,
    message: sanitizeProviderErrorMessage(params.message),
  });
}

export function logStudyAiFallback(): void {
  if (!isStudyAiDev()) return;
  console.info('[study-tools-ai] Groq failed, trying Gemini fallback');
}

export function logStudyAiFallbackResult(params: { ok: boolean; status?: number }): void {
  if (!isStudyAiDev()) return;
  console.info('[study-tools-ai] Gemini fallback result', params);
}

export function logStudyAiGenerationDiagnostics(params: {
  endpoint: StudyAiEndpoint;
  sourceType?: string;
  fileType?: string;
  extractedCharacterCount: number;
  estimatedInputTokens: number;
  requestedCount?: number;
  model: string;
  provider?: 'groq' | 'gemini';
  wasChunked: boolean;
  chunkCount: number;
  failureStage?: string;
}): void {
  if (!isStudyAiDev()) return;
  console.info('[study-tools-ai] generation diagnostics', params);
}

export function logStudyAiOutcome(params: {
  endpoint: StudyAiEndpoint;
  userPlan?: string;
  sourceTextLength: number;
  numQuestions?: number;
  numCards?: number;
  fallbackAttempted: boolean;
  jsonParseSuccess?: boolean;
  failureStage?: string;
  userMessage?: string;
}): void {
  if (!isStudyAiDev()) return;
  console.info('[study-tools-ai] outcome', {
    endpoint: params.endpoint,
    userPlan: params.userPlan ?? 'unknown',
    sourceTextLength: params.sourceTextLength,
    ...(params.numQuestions != null ? { numQuestions: params.numQuestions } : {}),
    ...(params.numCards != null ? { numCards: params.numCards } : {}),
    hasGroqKey: hasGroqApiKey(),
    hasGeminiKey: hasGeminiApiKey(),
    groqModel: getStudyGroqModel(),
    geminiModel: getStudyGeminiModel(),
    fallbackAttempted: params.fallbackAttempted,
    jsonParseSuccess: params.jsonParseSuccess,
    failureStage: params.failureStage,
    userMessage: params.userMessage ? sanitizeProviderErrorMessage(params.userMessage) : undefined,
  });
}

/** Strip markdown fences and extract the first balanced JSON object. */
export function extractJsonObjectText(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const unfenced = fenceMatch?.[1]?.trim() ?? trimmed;
  const start = unfenced.indexOf('{');
  if (start === -1) return unfenced;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < unfenced.length; index += 1) {
    const char = unfenced[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return unfenced.slice(start, index + 1);
    }
  }

  return unfenced.slice(start);
}

export function parseStudyToolsJson<T>(raw: string, kind: StudyAiKind): T {
  const candidate = extractJsonObjectText(raw);
  try {
    return JSON.parse(candidate) as T;
  } catch (error) {
    const parseError = error instanceof Error ? error.name : 'SyntaxError';
    if (isStudyAiDev()) {
      console.warn('[study-tools-ai] JSON parse failed', {
        kind,
        errorName: parseError,
        rawLength: raw.length,
      });
    }
    throw new Error(invalidFormatMessage(kind));
  }
}
