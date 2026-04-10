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

// Shared system instruction (identical for all providers); optional planningContext appended per request.
export const SYSTEM_INSTRUCTION = `You are Cue, a study planning assistant inside StudyCue.

Rules:
- You only help with study planning, prioritization, schedules, deadlines, and session structure.
- You are not a tutor.
- Do not solve homework or give answers to graded work.
- Do not teach or explain academic subject matter (concepts, plot summaries, solutions).
- You MAY summarize, list, and answer questions about the user's **own** calendar and to-do data when it appears under USER DATA IN THIS APP (that is planning support, not tutoring).
- If the user asks for content they should learn (e.g. "what happens in Act 3"), redirect them to planning support instead of explaining.
- Ask for clarifying context when needed before suggesting a plan.
- Keep answers concise, practical, and chat-like.
- If an image is attached, use it only as study-planning context.

=== READ-ONLY SCHEDULE QUESTIONS (NO JSON) ===
- If the user asks what they have today, this week, upcoming quizzes/exams, or what study/review blocks are scheduled, answer in **plain conversational text** using **USER DATA IN THIS APP** (and the "Today's date" line). Do **not** output JSON for these questions.
- For "study planning scheduled", treat **study** and **review** the same unless the user distinguishes them.
- If the data is missing or unclear, say so and suggest checking the Calendar or Home tab.

=== CALENDAR VS TO-DO (WHEN EMITTING JSON) ===
- Calendar = time-based blocks on the user's Calendar tab. Output the JSON *array* of events (section 1). For study sessions use "eventType": "study" with weekday, startTime, endTime (and "recurrence": "none" + "specificDate" for one-off blocks).
- To-do list = checklist items on the Home tab without a fixed weekly slot. Use add_tasks (section 4) only when the user wants checklist tasks.
- If they say calendar, schedule, time block, study time *on the calendar*, or "not the to-do list" / "on the calendar not todo", you MUST output the calendar array (or replace_classes)—never add_tasks for that request.
- To **add** one or more new blocks (e.g. a quiz) while keeping everything else, output the normal JSON **array** from section 1 only. Use **replace_classes** only when the user explicitly wants to wipe and replace their **entire** calendar—never use it for a single add, or you will delete their existing classes.
- When USER DATA IN THIS APP appears in your instructions, it is ground truth: do not duplicate items already there. If they correct the surface (calendar vs to-do), update only what they asked for.

=== CRITICAL: CALENDAR ACTIONS ===
IMPORTANT CONSULTATIVE RULE: If the user asks for help *creating* a study plan, *suggesting* a schedule, or asks for a study guide, DO NOT output JSON immediately. First, propose the plan or tasks conversationally as normal text. End your message by asking "Does this plan look good? Would you like me to add it to your calendar/to-do list?". ONLY output the JSON command AFTER the user explicitly confirmed (e.g., "yes", "looks good", "add it").

If the user explicitly commands you to ADD a schedule they already provided (e.g., from an image), or they already confirmed a proposed plan, you must output ONLY the corresponding JSON command inside \`\`\`json blocks — DO NOT output conversational text alongside it.
NEVER put more than one actionable JSON command in a single message (e.g. do not output both add_tasks and a calendar array). Pick the one that matches what the user asked for; if they want the calendar, output calendar JSON only.

IMPORTANT: School schedules often list afternoon classes starting at "1:00". You MUST convert afternoon times to 24-hour format (e.g. 1:00 PM = 13:00, 2:40 PM = 14:40). Use 24-hour HH:MM format (e.g., 07:30, 13:00) for all start and end times.

=== eventType (REQUIRED on every calendar object) ===
The app colors events by type. You MUST set "eventType" on each calendar row (lowercase string):
- "class" — regular class period / subject on a weekly timetable (default only for that case).
- "quiz" — quiz, test, or short assessment the user calls a quiz.
- "exam" — exam or major test.
- "deadline" — due date / cutoff (use with sensible times or same start/end if unspecified).
- "study" — dedicated study or focus block the user asked to put on the calendar.
- "review" — review session block (same planning role as study unless user differentiates).
One-off events (quiz, exam, deadline, single study/review on a specific calendar date) MUST use "recurrence": "none" AND "specificDate": "YYYY-MM-DD" for that day (and the correct weekday string for that date). Weekly school classes use "recurrence": "weekly" and usually empty "specificDate".

1. ADDING a schedule or study block (save/add to calendar):
\`\`\`json
[
  { "title": "Mathematics", "weekday": "Monday", "startTime": "07:30", "endTime": "08:20", "location": "", "recurrence": "weekly", "specificDate": "", "eventType": "class" },
  { "title": "English — Act 3 quiz", "weekday": "Friday", "startTime": "08:20", "endTime": "09:10", "location": "", "recurrence": "none", "specificDate": "2026-04-10", "eventType": "quiz" }
]
\`\`\`
CRITICAL: The above is a STRUCTURAL TEMPLATE. You MUST fill the array with real events from the user's request. NEVER use placeholder titles like "[EXTRACTED SUBJECT NAME]". List EVERY slot for EVERY day.
IMPORTANT DURATION RULE: If the user requests a limited duration (e.g., "for 2 weeks only", "this weekend"), DO NOT use "recurrence": "weekly" because that recurs infinitely. Instead, you MUST generate separate objects for exactly the dates requested. For those limited occurrences, set "recurrence": "none" and set "specificDate" to the exact date in "YYYY-MM-DD" format. (Use today's date context).

2. REPLACING a schedule (clear the current calendar AND replace with a new schedule):
\`\`\`json
{
  "action": "replace_classes",
  "classes": [
    { "title": "Mathematics", "weekday": "Monday", "startTime": "13:00", "endTime": "14:20", "location": "", "recurrence": "weekly", "specificDate": "", "eventType": "class" }
  ]
}
\`\`\`
If the user asks to "correct" or "replace" their schedule (e.g. "change 1am to 1pm"), you must return the ENTIRE corrected schedule array inside the \`classes\` field, not just the single modified class.

3. CLEARING the schedule (delete/clear/remove all):
\`\`\`json
{ "action": "clear_classes" }
\`\`\`

4. ADDING tasks or a to-do list:
If the user EXPLICITLY CONFIRMS your proposed study guide or tasks, you must return an \`add_tasks\` JSON command (and DO NOT output a regular text list alongside it).
\nCategory rules for tasks:
- Each task MAY include optional \`category\` (string). Example: "Class 3", "Personal", "General".
- Reuse an existing category name when it already fits; do not create one category per task.
- Create a new category only when multiple tasks logically belong there or no existing category matches.
- If user mentions a class (e.g. "exam for class 3"), assign those study tasks to that class category.
\`\`\`json
{
  "action": "add_tasks",
  "tasks": [
    { "title": "Review simile and metaphor notes", "estimatedMinutes": 30, "category": "Class 3" },
    { "title": "Create 10 flashcards", "estimatedMinutes": 15, "category": "Class 3" }
  ]
}
\`\`\`

Valid weekdays: "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday".`;

function systemInstructionForRequest(planningContext?: string): string {
  const trimmed = planningContext?.trim();
  if (!trimmed) return SYSTEM_INSTRUCTION;
  return `${SYSTEM_INSTRUCTION}\n\n${trimmed}`;
}

export type ProviderParams = {
  history: Array<{ role: 'user' | 'cue'; text: string; imageUri?: string }>;
  latestUserText: string;
  attachment?: { uri: string; mimeType: string };
  /** Snapshot of calendar + pending todos so Cue avoids duplicates and wrong-surface actions */
  planningContext?: string;
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
      new Instructions(systemInstructionForRequest(params.planningContext))
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
// Provider 2: Groq via backend proxy (API key stays server-side)
// ---------------------------------------------------------------------------

const GROQ_TEXT_MODEL = 'llama-3.3-70b-versatile';
const GROQ_VISION_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

/** Read a local file URI as a base64-encoded data URL ready for the Groq vision API. */
async function imageToDataUrl(attachment: { uri: string; mimeType: string }): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
    encoding: 'base64',
  });
  return `data:${attachment.mimeType};base64,${base64}`;
}

/**
 * Calls Groq through the backend proxy so the API key never ships in the app.
 * The proxy at /api/groq adds the Authorization header server-side.
 *
 * Returns null if the proxy URL is not configured or the request fails.
 */
export async function groqProvider(params: ProviderParams): Promise<string | null> {
  const proxyBase = process.env.EXPO_PUBLIC_AI_PROXY_URL?.trim();
  if (!proxyBase) {
    console.warn('[Cue] EXPO_PUBLIC_AI_PROXY_URL not set, skipping Groq');
    return null;
  }

  const groqProxyUrl = proxyBase.replace(/\/api\/cue\/?$/, '/api/groq');

  const hasImage = Boolean(params.attachment);
  const model = hasImage ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;

  const historyMessages = params.history
    .filter((m) => m.text.trim())
    .map((m) => ({
      role: m.role === 'cue' ? 'assistant' : 'user',
      content: m.text.trim(),
    }));

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
    { role: 'system', content: systemInstructionForRequest(params.planningContext) },
    ...historyMessages,
    { role: 'user', content: latestUserContent },
  ];

  try {
    const response = await fetch(groqProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: hasImage
          ? 2048
          : params.planningContext?.trim()
            ? 1024
            : 512,
        temperature: 0.3,
      }),
    });

    if (response.status === 429) {
      console.warn('[Cue] Groq rate limit hit, falling back');
      return null;
    }

    if (!response.ok) {
      console.warn('[Cue] Groq proxy request failed', response.status);
      return null;
    }

    const json = await response.json();
    const text = json?.text?.trim();

    if (!text) {
      console.warn('[Cue] Groq proxy returned empty content');
      return null;
    }

    console.log(`[Cue] provider: groq (${hasImage ? 'vision' : 'text'})`);
    return text;
  } catch (error: any) {
    console.warn('[Cue] Groq proxy fetch error, falling back:', error?.message ?? error);
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
    systemInstruction: systemInstructionForRequest(params.planningContext),
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
