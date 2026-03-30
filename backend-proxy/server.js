import 'dotenv/config';
import cors from 'cors';
import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3000);
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash';

app.use(cors());
app.use(express.json({ limit: '10mb' }));

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

  const requestBody = {
    system_instruction: {
      parts: [{ text: typeof systemInstruction === 'string' ? systemInstruction : '' }],
    },
    contents: [...history, latestUserMessage],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
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

app.listen(port, () => {
  console.log(`StudyCue AI proxy listening on http://localhost:${port}`);
});
