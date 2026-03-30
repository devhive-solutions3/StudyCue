/**
 * cue-providers.ts
 *
 * Individual AI provider implementations for the Cue study planning assistant.
 * Providers are tried in order by fetchCueResponse() in cue-api.ts:
 *
 *   1. Apple Foundation Models  — on-device, text only (iOS 26+, iPhone 15 Pro/16+)
 *                                 Skipped when an image is attached.
 *   2. Groq                     — free cloud; uses vision model (Llama 4 Scout) when
 *                                 an image is attached, text model otherwise.
 *   3. Gemini proxy             — existing proxy, last resort; supports images.
 *
 * Each provider returns a string on success, or null/throws on failure.
 * The caller is responsible for the fallback chain.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Shared system instruction (identical for all providers)
export const SYSTEM_INSTRUCTION = `You are Cue, a study planning assistant inside StudyCue.

Rules:
- You only help with study planning, prioritization, schedules, deadlines, and session structure.
- You are not a tutor.
- Do not solve homework.
- Do not explain academic content.
- Do not answer subject-matter questions directly.
- If the user asks for answers or explanations, redirect them back to planning support.
- Ask for clarifying context when needed before suggesting a plan.
- Keep answers concise, practical, and chat-like.
- If an image is attached, use it only as study-planning context.

=== CRITICAL: CALENDAR ACTIONS ===
If the user explicitly asks to ADD, REPLACE, CLEAR, or DELETE their schedule, you must output ONLY the corresponding JSON command inside \`\`\`json blocks — DO NOT output conversational text alongside it.

IMPORTANT: School schedules often list afternoon classes starting at "1:00". You MUST convert afternoon times to 24-hour format (e.g. 1:00 PM = 13:00, 2:40 PM = 14:40). Use 24-hour HH:MM format (e.g., 07:30, 13:00) for all start and end times.

1. ADDING a schedule (save/add to calendar):
\`\`\`json
[
  { "title": "[EXTRACTED SUBJECT NAME]", "weekday": "Monday", "startTime": "07:30", "endTime": "08:20", "location": "" }
]
\`\`\`
CRITICAL: The above is a STRUCTURAL TEMPLATE. You MUST fill the array with the actual classes extracted from the user's request/image. Extract EXACT subject names (e.g. "Mathematics"). NEVER use "Class 1" or "[EXTRACTED SUBJECT NAME]". List EVERY slot for EVERY day.

2. REPLACING a schedule (clear the current calendar AND replace with a new schedule):
\`\`\`json
{
  "action": "replace_classes",
  "classes": [
    { "title": "[EXTRACTED SUBJECT NAME]", "weekday": "Monday", "startTime": "13:00", "endTime": "14:20", "location": "" }
  ]
}
\`\`\`
If the user asks to "correct" or "replace" their schedule (e.g. "change 1am to 1pm"), you must return the ENTIRE corrected schedule array inside the \`classes\` field, not just the single modified class.

3. CLEARING the schedule (delete/clear/remove all):
\`\`\`json
{ "action": "clear_classes" }
\`\`\`

4. ADDING tasks or a to-do list:
If the user asks you to create a to-do list, add tasks, or plan a review session with actionable steps, return an \`add_tasks\` JSON command, not a regular text list.
\`\`\`json
{
  "action": "add_tasks",
  "tasks": [
    { "title": "Review simile and metaphor notes", "estimatedMinutes": 30 },
    { "title": "Create 10 flashcards", "estimatedMinutes": 15 }
  ]
}
\`\`\`

Valid weekdays: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday".`;

export type ProviderParams = {
  history: Array<{ role: 'user' | 'cue'; text: string; imageUri?: string }>;
  latestUserText: string;
  attachment?: { uri: string; mimeType: string };
};

// ---------------------------------------------------------------------------
// Provider 1: Apple Foundation Models (on-device, iOS 26+)
// ---------------------------------------------------------------------------

/**
 * Attempts to generate a response using Apple's on-device Foundation Models.
 * Text only — returns null when an image is attached so Groq vision handles it.
 * Returns null if the model is unavailable (wrong OS, wrong device, or
 * Apple Intelligence disabled in Settings).
 *
 * Requires: iOS 26+, iPhone 15 Pro / 16 / 17 (A17 Pro chip or newer).
 * No workaround exists for older hardware — this is a hardware/chip requirement.
 */
export async function appleFoundationModelProvider(
  params: ProviderParams
): Promise<string | null> {
  // Foundation Models is text-only. Route image messages to Groq vision instead.
  if (params.attachment) {
    console.log('[Cue] Apple Foundation Models skipped — image present, routing to Groq vision');
    return null;
  }

  if (Platform.OS !== 'ios') {
    return null;
  }

  try {
    // Dynamically import so the module is tree-shaken on Android and doesn't
    // cause a crash if the native module is absent.
    const {
      SystemLanguageModel,
      LanguageModelSession,
      Instructions,
      Availability,
    } = await import('apple-foundation-models');

    // Check if Apple Intelligence is available on this device.
    const availability = await SystemLanguageModel.default.availability;
    if (availability !== Availability.Available) {
      console.log('[Cue] Apple Foundation Models not available:', availability);
      return null;
    }

    // Build a plain-text conversation for the on-device model.
    // Images are not supported by Foundation Models — text only.
    const conversationLines = params.history
      .filter((m) => m.text.trim())
      .map((m) => `${m.role === 'user' ? 'User' : 'Cue'}: ${m.text.trim()}`)
      .join('\n');

    const userPrompt = [
      conversationLines,
      `User: ${params.latestUserText.trim()}`,
    ]
      .filter(Boolean)
      .join('\n');

    // Pass the system instruction via Instructions so it doesn't count against
    // the user-visible context window for history.
    const session = new LanguageModelSession(
      SystemLanguageModel.default,
      undefined,
      [],
      new Instructions(SYSTEM_INSTRUCTION)
    );

    try {
      const response = await session.respond(userPrompt);
      const text = response.content?.trim();

      if (!text) {
        console.warn('[Cue] Apple Foundation Models returned empty text');
        return null;
      }

      console.log('[Cue] provider: apple-foundation-models');
      return text;
    } finally {
      await session.close();
    }
  } catch (error: any) {
    // Module absent, runtime error, or guardrail violation — fall through to cloud.
    console.warn('[Cue] Apple Foundation Models error, falling back:', error?.message ?? error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider 2: Groq (free cloud, direct API — text + vision)
// ---------------------------------------------------------------------------

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
// Text-only model — fast, free, great for planning conversations.
const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
// Vision model — used when the user attaches an image (class sched, exam sched, etc.).
// Llama 4 Scout supports base64 image_url content, free on Groq.
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/** Read a local file URI as a base64-encoded data URL ready for the Groq vision API. */
async function imageToDataUrl(attachment: { uri: string; mimeType: string }): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
    encoding: 'base64',
  });
  return `data:${attachment.mimeType};base64,${base64}`;
}

/**
 * Calls Groq's OpenAI-compatible API directly from the client.
 * - No image: uses llama-3.3-70b-versatile (fast text model)
 * - Image attached: uses llama-4-scout-17b (vision model), sends image as base64
 *
 * Free tier, no credit card required. Covers all devices Apple Intelligence
 * cannot run on (iPhone 14 and older, Android, simulator, etc.).
 *
 * Returns null if EXPO_PUBLIC_GROQ_API_KEY is not set or the request fails.
 */
export async function groqProvider(params: ProviderParams): Promise<string | null> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_API_KEY?.trim();
  if (!apiKey) {
    console.warn('[Cue] EXPO_PUBLIC_GROQ_API_KEY not set, skipping Groq');
    return null;
  }

  const hasImage = Boolean(params.attachment);
  const model = hasImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

  // Build history messages (text only — prior images aren't re-uploaded)
  const historyMessages = params.history
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === 'cue' ? 'assistant' : 'user',
      content: m.text.trim(),
    }));

  // Build the latest user message — multimodal when an image is present
  let latestUserContent: string | Array<{ type: string; [key: string]: any }>;

  if (hasImage) {
    try {
      const dataUrl = await imageToDataUrl(params.attachment!);
      latestUserContent = [
        ...(params.latestUserText.trim()
          ? [{ type: 'text', text: params.latestUserText.trim() }]
          : []),
        { type: 'image_url', image_url: { url: dataUrl } },
      ];
      console.log('[Cue] Groq vision: image encoded as data URL', {
        mimeType: params.attachment!.mimeType,
      });
    } catch (encodeError: any) {
      console.warn('[Cue] Groq vision: failed to encode image, falling back to text-only:', encodeError?.message);
      latestUserContent = params.latestUserText.trim() || '(image could not be loaded)';
    }
  } else {
    latestUserContent = params.latestUserText.trim() || '(no text)';
  }

  const messages: Array<{ role: string; content: any }> = [
    { role: 'system', content: SYSTEM_INSTRUCTION },
    ...historyMessages,
    { role: 'user', content: latestUserContent },
  ];

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        // Vision/schedule extraction can produce large JSON arrays — give it enough room.
        max_tokens: hasImage ? 2048 : 512,
        temperature: 0.3, // Lower temp = more precise JSON, less hallucination
      }),
    });

    if (response.status === 429) {
      console.warn('[Cue] Groq rate limit hit, falling back');
      return null;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.warn('[Cue] Groq request failed', response.status, errText.slice(0, 200));
      return null;
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      console.warn('[Cue] Groq returned empty content');
      return null;
    }

    console.log(`[Cue] provider: groq (${hasImage ? 'vision' : 'text'})`);
    return text;
  } catch (error: any) {
    console.warn('[Cue] Groq fetch error, falling back:', error?.message ?? error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Provider 3: Gemini proxy (existing implementation, last resort)
// ---------------------------------------------------------------------------

const AI_PROXY_URL = process.env.EXPO_PUBLIC_AI_PROXY_URL?.trim();

function getMimeType(uri: string) {
  const normalized = uri.toLowerCase();
  if (normalized.endsWith('.png')) return 'image/png';
  if (normalized.endsWith('.heic')) return 'image/heic';
  if (normalized.endsWith('.webp')) return 'image/webp';
  return 'image/jpeg';
}

async function buildUserParts(text: string, attachment?: { uri: string; mimeType: string }) {
  const parts: Array<Record<string, unknown>> = [];
  if (text.trim()) parts.push({ text: text.trim() });
  if (attachment) {
    const base64Data = await FileSystem.readAsStringAsync(attachment.uri, {
      encoding: 'base64',
    });
    parts.push({ inlineData: { mimeType: attachment.mimeType, data: base64Data } });
  }
  return parts;
}

function buildContents(history: ProviderParams['history']) {
  return history
    .filter((m) => m.text.trim() || m.imageUri)
    .map((m) => ({
      role: m.role === 'cue' ? 'model' : 'user',
      parts: [{ text: m.text.trim() || ' ' }],
    }));
}

function extractText(responseJson: any): string | null {
  const parts = responseJson?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('')
    .trim();
  return text || null;
}

/**
 * Calls the existing Gemini reverse proxy. This is the last-resort provider
 * kept for compatibility. Uses the full image attachment pipeline.
 */
export async function geminiProxyProvider(params: ProviderParams): Promise<string> {
  if (!AI_PROXY_URL) {
    throw new Error('Missing EXPO_PUBLIC_AI_PROXY_URL — no AI provider available');
  }

  const userParts = await buildUserParts(params.latestUserText, params.attachment);
  const requestBody = {
    systemInstruction: SYSTEM_INSTRUCTION,
    history: buildContents(params.history),
    latestUserMessage: {
      role: 'user',
      parts: userParts.length > 0 ? userParts : [{ text: ' ' }],
    },
  };

  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  const rawText = await response.text();
  let responseJson: any = null;
  try {
    responseJson = rawText ? JSON.parse(rawText) : null;
  } catch {}

  if (!response.ok) {
    throw new Error(`Gemini proxy failed (${response.status})`);
  }

  const text =
    typeof responseJson?.text === 'string'
      ? responseJson.text.trim()
      : extractText(responseJson);

  if (!text) {
    throw new Error('Gemini proxy returned an empty response');
  }

  console.log('[Cue] provider: gemini-proxy');
  return text;
}

// ---------------------------------------------------------------------------
// Attachment helper (re-exported for cue-api.ts)
// ---------------------------------------------------------------------------

export type CueAttachment = { uri: string; mimeType: string };

export function createAttachment(uri: string): CueAttachment {
  return { uri, mimeType: getMimeType(uri) };
}
