import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3001);
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';
const groqApiKey = process.env.GROQ_API_KEY?.trim();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

/** Root URL — Fly "visit app" and uptime checks expect 200 here, not 404. */
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'studycue-ai-proxy',
    endpoints: { health: '/health', gemini: 'POST /api/cue', groq: 'POST /api/groq' },
  });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/cue', async (req, res) => {
  if (!geminiApiKey) {
    res.status(500).json({ error: 'Missing GEMINI_API_KEY on the server.' });
    return;
  }

  const { history, latestUserMessage, systemInstruction } = req.body ?? {};

  if (!Array.isArray(history) || !latestUserMessage || !Array.isArray(latestUserMessage.parts)) {
    res.status(400).json({ error: 'Invalid Cue payload.' });
    return;
  }

  const hasImagePart =
    Array.isArray(latestUserMessage.parts) &&
    latestUserMessage.parts.some((part) => part && typeof part === 'object' && part.inlineData);

  const requestedMax =
    typeof req.body?.maxOutputTokens === 'number' && Number.isFinite(req.body.maxOutputTokens)
      ? Math.round(req.body.maxOutputTokens)
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

  const requestUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${geminiApiKey}`;

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    let responseJson = null;

    try {
      responseJson = rawText ? JSON.parse(rawText) : null;
    } catch (error) {
      console.error('[studycue-ai-proxy] Failed to parse Gemini response', error);
    }

    if (!response.ok) {
      console.error('[studycue-ai-proxy] Gemini request failed', {
        status: response.status,
        statusText: response.statusText,
        response: responseJson,
      });
      res.status(502).json({ error: 'Upstream AI request failed.' });
      return;
    }

    const candidateParts = responseJson?.candidates?.[0]?.content?.parts;
    const text = Array.isArray(candidateParts)
      ? candidateParts
          .map((part) => (typeof part?.text === 'string' ? part.text : ''))
          .join('')
          .trim()
      : '';

    if (!text) {
      res.status(502).json({ error: 'AI response was empty.' });
      return;
    }

    res.json({ text });
  } catch (error) {
    console.error('[studycue-ai-proxy] Request error', error);
    res.status(500).json({ error: 'Internal proxy error.' });
  }
});

app.post('/api/groq', async (req, res) => {
  if (!groqApiKey) {
    res.status(500).json({ error: 'Missing GROQ_API_KEY on the server.' });
    return;
  }

  const { messages, model, max_tokens, temperature } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Invalid Groq payload.' });
    return;
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
      res.status(429).json({ error: 'Groq rate limit hit.' });
      return;
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      console.error('[studycue-ai-proxy] Groq request failed', response.status, errText.slice(0, 200));
      res.status(502).json({ error: 'Upstream Groq request failed.' });
      return;
    }

    const json = await response.json();
    const text = json?.choices?.[0]?.message?.content?.trim();

    if (!text) {
      res.status(502).json({ error: 'Groq response was empty.' });
      return;
    }

    res.json({ text });
  } catch (error) {
    console.error('[studycue-ai-proxy] Groq request error', error);
    res.status(500).json({ error: 'Internal proxy error.' });
  }
});

app.listen(port, () => {
  console.log(`StudyCue AI proxy listening on http://localhost:${port}`);
});
