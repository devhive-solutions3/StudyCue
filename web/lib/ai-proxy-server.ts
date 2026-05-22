/**
 * Server-side Cue AI handlers (Groq + Gemini).
 * Used by Next.js /api/groq and /api/cue — same contract as backend-proxy/server.js.
 */

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';

export type GroqProxyBody = {
  messages?: Array<{ role: string; content: unknown }>;
  model?: string;
  max_tokens?: number;
  temperature?: number;
};

export type CueGeminiProxyBody = {
  history?: Array<{ role: string; parts: Array<Record<string, unknown>> }>;
  latestUserMessage?: { role: string; parts: Array<Record<string, unknown>> };
  systemInstruction?: string;
  maxOutputTokens?: number;
};

export async function handleGroqProxy(body: GroqProxyBody): Promise<Response> {
  const groqApiKey = process.env.GROQ_API_KEY?.trim();
  if (!groqApiKey) {
    return Response.json({ error: 'Missing GROQ_API_KEY on the server.' }, { status: 500 });
  }

  const { messages, model, max_tokens, temperature } = body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: 'Invalid Groq payload.' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${groqApiKey}`,
      },
      body: JSON.stringify({ model, messages, max_tokens, temperature }),
    });

    if (response.status === 429) {
      return Response.json({ error: 'Groq rate limit hit.' }, { status: 429 });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[ai-proxy] Groq request failed', response.status, errText.slice(0, 200));
      return Response.json({ error: 'Upstream Groq request failed.' }, { status: 502 });
    }

    const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return Response.json({ error: 'Groq response was empty.' }, { status: 502 });
    }

    return Response.json({ text });
  } catch (error) {
    console.error('[ai-proxy] Groq request error', error);
    return Response.json({ error: 'Internal proxy error.' }, { status: 500 });
  }
}

export async function handleCueGeminiProxy(body: CueGeminiProxyBody): Promise<Response> {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (!geminiApiKey) {
    return Response.json({ error: 'Missing GEMINI_API_KEY on the server.' }, { status: 500 });
  }

  const geminiModel = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const { history, latestUserMessage, systemInstruction } = body ?? {};

  if (!Array.isArray(history) || !latestUserMessage || !Array.isArray(latestUserMessage.parts)) {
    return Response.json({ error: 'Invalid Cue payload.' }, { status: 400 });
  }

  const hasImagePart = latestUserMessage.parts.some(
    (part) => part && typeof part === 'object' && 'inlineData' in part,
  );

  const requestedMax =
    typeof body.maxOutputTokens === 'number' && Number.isFinite(body.maxOutputTokens)
      ? Math.round(body.maxOutputTokens)
      : null;
  const maxOutputTokens = requestedMax
    ? Math.min(8192, Math.max(256, requestedMax))
    : hasImagePart
      ? 2048
      : 1024;

  const requestBody = {
    system_instruction: {
      parts: [{ text: typeof systemInstruction === 'string' ? systemInstruction : '' }],
    },
    contents: [...history, latestUserMessage],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens,
    },
  };

  const requestUrl = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    type GeminiResponse = {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    let responseJson: GeminiResponse | null = null;

    try {
      responseJson = rawText ? (JSON.parse(rawText) as GeminiResponse) : null;
    } catch (error) {
      console.error('[ai-proxy] Failed to parse Gemini response', error);
    }

    if (!response.ok) {
      console.error('[ai-proxy] Gemini request failed', {
        status: response.status,
        response: responseJson,
      });
      return Response.json({ error: 'Upstream AI request failed.' }, { status: 502 });
    }

    const candidateParts = responseJson?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(candidateParts)
      ? candidateParts
          .map((part) => (typeof part?.text === 'string' ? part.text : ''))
          .join('')
          .trim()
      : '';

    if (!text) {
      return Response.json({ error: 'AI response was empty.' }, { status: 502 });
    }

    return Response.json({ text });
  } catch (error) {
    console.error('[ai-proxy] Gemini request error', error);
    return Response.json({ error: 'Internal proxy error.' }, { status: 500 });
  }
}
