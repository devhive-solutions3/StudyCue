import type { CloudMirrorV1 } from '@studycue/types';
import { systemInstructionForRequest } from '@/lib/cue-system-prompt';
import { publicEnv } from '@/lib/public-env';

const GROQ_TEXT = 'llama-3.3-70b-versatile';
const GROQ_VISION = 'meta-llama/llama-4-scout-17b-16e-instruct';

import type { CueStudyCommandType } from '@/lib/cue-study-command';
import type { FlashcardItem, QuizQuestion } from '@/lib/study-tools-types';

export type CueStudyResultPayload =
  | {
      kind: 'quiz';
      sourceName: string;
      count: number;
      requestedFolderName?: string | null;
      questions: QuizQuestion[];
    }
  | {
      kind: 'flashcards';
      sourceName: string;
      count: number;
      requestedFolderName?: string | null;
      cards: FlashcardItem[];
    };

export type CueMsg = {
  role: 'user' | 'cue';
  text: string;
  imagePreviewUrl?: string;
  studyFileName?: string;
  studyResult?: CueStudyResultPayload;
};

export type CueWebAttachment = { dataUrl: string; mimeType: string };

function resolveProxyEndpoint(base: string, endpoint: 'cue' | 'groq'): string {
  const root = base.trim().replace(/\/$/, '');
  // Same-origin Next routes (local + Vercel): /api/cue and /api/groq
  if (root === '/api/cue' || root === '/api/groq') {
    return endpoint === 'groq' ? '/api/groq' : '/api/cue';
  }
  if (endpoint === 'groq') {
    if (root.endsWith('/api/groq')) return root;
    if (root.endsWith('/api/cue')) return root.replace(/\/api\/cue$/, '/api/groq');
    return `${root}/api/groq`;
  }
  if (root.endsWith('/api/cue')) return root;
  if (root.endsWith('/api/groq')) return root.replace(/\/api\/groq$/, '/api/cue');
  return `${root}/api/cue`;
}

/** Default: built-in Next.js proxy routes (no separate backend-proxy process). */
export function defaultAiProxyBase(): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api/cue`;
  }
  return '/api/cue';
}

async function readResponseBody(res: Response): Promise<{ json: unknown | null; raw: string }> {
  const raw = await res.text();
  if (!raw) return { json: null, raw };
  try {
    return { json: JSON.parse(raw) as unknown, raw };
  } catch {
    return { json: null, raw };
  }
}

function proxyErrorMessage(json: unknown, raw: string, status: number): string {
  if (json && typeof json === 'object' && 'error' in json) {
    const err = (json as { error?: unknown }).error;
    if (typeof err === 'string' && err.trim()) return err.trim();
  }
  if (raw.trim().startsWith('<')) {
    return `Proxy returned HTML (HTTP ${status}). Check EXPO_PUBLIC_AI_PROXY_URL points to /api/cue or your Fly proxy.`;
  }
  const snippet = raw.trim().slice(0, 120);
  return snippet ? `HTTP ${status}: ${snippet}` : `HTTP ${status}`;
}

function buildGroqUserContent(
  params: {
    latestUserText: string;
    attachment?: CueWebAttachment;
    planningContext?: string;
  },
  hasImage: boolean,
): string | Array<{ type: string; text?: string; image_url?: { url: string } }> {
  if (!hasImage || !params.attachment) {
    return params.latestUserText.trim() || '(no message)';
  }

  const parts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (params.planningContext?.trim()) {
    parts.push({ type: 'text', text: params.planningContext.trim() });
  }
  if (params.latestUserText.trim()) {
    parts.push({ type: 'text', text: params.latestUserText.trim() });
  }
  parts.push({ type: 'image_url', image_url: { url: params.attachment.dataUrl } });
  return parts;
}

export async function fetchCueResponseWeb(params: {
  history: CueMsg[];
  latestUserText: string;
  attachment?: CueWebAttachment;
  planningContext?: string;
  getIdToken?: () => Promise<string>;
}): Promise<string> {
  const proxyBase = publicEnv('AI_PROXY_URL') || defaultAiProxyBase();
  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `cue-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const authHeader: Record<string, string> = {};
  try {
    const token = params.getIdToken && (await params.getIdToken());
    if (token) authHeader.Authorization = `Bearer ${token}`;
  } catch {
    /* optional */
  }
  authHeader['X-StudyCue-Request-Id'] = requestId;

  const groqUrl = resolveProxyEndpoint(proxyBase, 'groq');
  const cueUrl = resolveProxyEndpoint(proxyBase, 'cue');
  const hasImage = Boolean(params.attachment?.dataUrl);

  const historyMessages = params.history
    .filter((m) => m.text.trim())
    .map((m) => ({ role: m.role === 'cue' ? ('assistant' as const) : ('user' as const), content: m.text.trim() }));

  // Keep the Groq system prompt smaller for vision — planning context goes in the user message.
  const groqSystem = systemInstructionForRequest(hasImage ? undefined : params.planningContext);

  const groqBody = {
    model: hasImage ? GROQ_VISION : GROQ_TEXT,
    messages: [
      { role: 'system' as const, content: groqSystem },
      ...historyMessages,
      { role: 'user' as const, content: buildGroqUserContent(params, hasImage) },
    ],
    max_tokens: hasImage ? 2048 : params.planningContext?.trim() ? 1024 : 512,
    temperature: 0.3,
  };

  let groqFailure: string | null = null;

  try {
    const res = await fetch(groqUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader },
      body: JSON.stringify(groqBody),
    });
    const { json, raw } = await readResponseBody(res);

    if (res.status === 429) {
      groqFailure = 'rate limit';
    } else if (res.ok && json && typeof (json as { text?: unknown }).text === 'string') {
      const text = String((json as { text: string }).text).trim();
      if (text) return text;
      groqFailure = 'empty response';
    } else {
      groqFailure = proxyErrorMessage(json, raw, res.status);
    }
  } catch (error) {
    groqFailure = error instanceof Error ? error.message : 'network error';
  }

  try {
    return await fetchGeminiFallback(params, cueUrl, authHeader, hasImage);
  } catch (geminiError) {
    const geminiMsg = geminiError instanceof Error ? geminiError.message : 'Gemini fallback failed';
    if (groqFailure && groqFailure !== 'rate limit') {
      throw new Error(`Groq failed (${groqFailure}). Gemini fallback: ${geminiMsg}`);
    }
    if (groqFailure === 'rate limit') {
      throw new Error(`Groq rate limit. Gemini fallback: ${geminiMsg}`);
    }
    throw geminiError;
  }
}

function dataUrlToBase64(dataUrl: string): string {
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

async function fetchGeminiFallback(
  params: {
    history: CueMsg[];
    latestUserText: string;
    attachment?: CueWebAttachment;
    planningContext?: string;
  },
  cueUrl: string,
  authHeader: Record<string, string>,
  hasImage: boolean,
): Promise<string> {
  const parts: Array<Record<string, unknown>> = [];
  if (params.planningContext?.trim() && hasImage) {
    parts.push({ text: params.planningContext.trim() });
  }
  if (params.latestUserText.trim()) parts.push({ text: params.latestUserText.trim() });
  if (params.attachment?.dataUrl) {
    parts.push({
      inlineData: {
        mimeType: params.attachment.mimeType,
        data: dataUrlToBase64(params.attachment.dataUrl),
      },
    });
  }
  if (parts.length === 0) parts.push({ text: ' ' });

  const history = params.history
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === 'cue' ? ('model' as const) : ('user' as const),
      parts: [{ text: m.text.trim() }],
    }));

  const body = {
    systemInstruction: systemInstructionForRequest(params.planningContext),
    history,
    latestUserMessage: {
      role: 'user',
      parts,
    },
    maxOutputTokens: hasImage ? 2048 : 1024,
  };

  const res = await fetch(cueUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader },
    body: JSON.stringify(body),
  });

  const { json, raw } = await readResponseBody(res);
  if (!json) {
    throw new Error(proxyErrorMessage(null, raw, res.status));
  }

  if (!res.ok) {
    throw new Error(proxyErrorMessage(json, raw, res.status));
  }

  const text =
    typeof (json as { text?: unknown })?.text === 'string'
      ? String((json as { text: string }).text).trim()
      : extractGeminiCandidateText(json);
  if (text) return text;
  throw new Error('Cue returned empty text');
}

function extractGeminiCandidateText(payload: unknown): string {
  const parts = (payload as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content
    ?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
}

export function snapshotToPlanningPrompt(m: CloudMirrorV1): string {
  const now = new Date();
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(now);
  const y = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const localIso = `${y}-${month}-${day}`;

  const lines: string[] = [
    '=== USER DATA IN THIS APP (source of truth when deciding what already exists) ===',
    `Today's date (device local): ${today}, ${localIso}`,
    'Calendar eventType values below: class | quiz | exam | deadline | study | review (app colors follow these types).',
  ];

  if (m.classes.length === 0) {
    lines.push('Calendar: (no saved entries)');
  } else {
    lines.push(`Calendar (${m.classes.length} saved):`);
    for (const c of m.classes.slice(0, 35)) {
      if (!c.title?.trim()) continue;
      const when = [c.weekday, c.startTime, c.endTime].filter(Boolean).join(' ');
      lines.push(
        `- ${c.title.trim().slice(0, 72)} | ${when} | ${c.eventType || 'class'}${c.specificDate ? ` | ${c.specificDate}` : ''}`,
      );
    }
    if (m.classes.length > 35) {
      lines.push(`... +${m.classes.length - 35} more calendar rows`);
    }
  }

  const pendingTasks = m.tasks.filter((t) => {
    const s = (t.status ?? '').toLowerCase();
    return s !== 'completed' && s !== 'done';
  });

  if (m.taskCategories.length > 0) {
    lines.push(`Task categories (${m.taskCategories.length}):`);
    for (const c of m.taskCategories.slice(0, 20)) {
      lines.push(`- ${c.name}`);
    }
  } else {
    lines.push('Task categories: (none yet)');
  }

  if (pendingTasks.length === 0) {
    lines.push('To-do (pending): (none)');
  } else {
    lines.push(`To-do (pending, ${pendingTasks.length}):`);
    for (const t of pendingTasks.slice(0, 30)) {
      if (!t.title?.trim()) continue;
      lines.push(`- ${t.title.trim().slice(0, 72)}`);
    }
  }

  lines.push(
    'Before emitting JSON: calendar rows must include the correct "eventType" (quiz/exam/study/review/deadline/class). For read-only questions about this schedule, answer in plain text—no JSON.',
  );

  return lines.join('\n');
}

export type CueStudyGenerateResponse =
  | {
      ok: true;
      kind: 'quiz';
      message: string;
      sourceName: string;
      count: number;
      requestedFolderName?: string | null;
      quiz: QuizQuestion[];
    }
  | {
      ok: true;
      kind: 'flashcards';
      message: string;
      sourceName: string;
      count: number;
      requestedFolderName?: string | null;
      flashcards: FlashcardItem[];
    };

export async function fetchCueStudyGenerate(params: {
  commandType: Exclude<CueStudyCommandType, 'none' | 'both'>;
  text: string;
  sourceName: string;
  sourceType: 'paste' | 'upload';
  count: number;
  requestedFolderName?: string | null;
  getIdToken?: () => Promise<string>;
}): Promise<{ message: string; studyResult: CueStudyResultPayload }> {
  const requestId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `cue-study-${Date.now()}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-StudyCue-Request-Id': requestId,
  };
  try {
    const token = params.getIdToken && (await params.getIdToken());
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    /* optional */
  }

  const res = await fetch('/api/cue/study-generate', {
    method: 'POST',
    headers,
    credentials: 'same-origin',
    body: JSON.stringify({
      commandType: params.commandType,
      text: params.text,
      sourceName: params.sourceName,
      sourceType: params.sourceType,
      count: params.count,
      requestedFolderName: params.requestedFolderName,
    }),
  });

  const payload = (await res.json().catch(() => null)) as
    | (CueStudyGenerateResponse & { error?: string })
    | { error?: string }
    | null;

  if (!res.ok) {
    throw new Error(
      payload && typeof payload === 'object' && 'error' in payload && payload.error
        ? String(payload.error)
        : `HTTP ${res.status}`,
    );
  }

  if (!payload || !('kind' in payload) || payload.kind === undefined) {
    throw new Error('Invalid study generation response.');
  }

  if (payload.kind === 'quiz') {
    return {
      message: payload.message,
      studyResult: {
        kind: 'quiz',
        sourceName: payload.sourceName,
        count: payload.count,
        requestedFolderName: payload.requestedFolderName ?? null,
        questions: payload.quiz,
      },
    };
  }

  return {
    message: payload.message,
    studyResult: {
      kind: 'flashcards',
      sourceName: payload.sourceName,
      count: payload.count,
      requestedFolderName: payload.requestedFolderName ?? null,
      cards: payload.flashcards,
    },
  };
}
