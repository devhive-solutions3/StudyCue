import 'server-only';

export type StudyAiEndpoint = 'generate-quiz' | 'generate-flashcards' | 'file-study';
export type StudyAiKind = 'quiz' | 'flashcards' | 'file-study';

export const STUDY_AI_USER_ERRORS = {
  noProvider:
    'AI provider is not configured. Add GROQ_API_KEY or GEMINI_API_KEY.',
  groqModel:
    'Groq model failed or is unavailable. Check the configured model.',
  invalidQuiz: 'AI returned an invalid quiz format. Please try again.',
  invalidFlashcards: 'AI returned an invalid flashcards format. Please try again.',
  invalidFileStudy: 'AI returned an invalid study format. Please try again.',
  allProvidersFailed:
    'AI generation failed. Please check provider keys or try again.',
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

  if (status === 500 && /Missing GROQ_API_KEY/i.test(err)) {
    return STUDY_AI_USER_ERRORS.noProvider;
  }
  if (status === 500 && /Missing GEMINI_API_KEY/i.test(err)) {
    return STUDY_AI_USER_ERRORS.noProvider;
  }
  if (status === 429) {
    return provider === 'groq'
      ? 'Groq rate limit hit. Please try again shortly.'
      : 'Gemini rate limit hit. Please try again shortly.';
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

  const groqOnly = failures.length === 1 && failures[0]?.provider === 'groq';
  if (groqOnly) {
    return mapProxyErrorToUserMessage('groq', failures[0]!.status ?? 502, failures[0]!.message);
  }

  const geminiOnly = failures.length === 1 && failures[0]?.provider === 'gemini';
  if (geminiOnly) {
    return mapProxyErrorToUserMessage('gemini', failures[0]!.status ?? 502, failures[0]!.message);
  }

  return STUDY_AI_USER_ERRORS.allProvidersFailed;
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
    plan: params.plan ?? 'unknown',
    provider: params.provider,
    model: params.model,
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
