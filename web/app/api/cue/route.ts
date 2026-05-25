import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { recordAiUsageLog } from '@/lib/admin-data';
import { rateLimitHeaders, takeRateLimit } from '@/lib/rate-limit';
import { handleCueGeminiProxy, type CueGeminiProxyBody } from '@/lib/ai-proxy-server';

export const runtime = 'nodejs';
const AI_LIMIT = 20;
const AI_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const viewer = await requireFirebaseAuth(req);
  if (process.env.NODE_ENV !== 'production') {
    console.info('[cue-api] request received', {
      endpoint: '/api/cue',
      uidDetected: Boolean(viewer?.uid),
    });
  }
  if (!viewer) {
    await recordAiUsageLog({
      uid: 'anonymous',
      email: null,
      authenticated: false,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
      status: 'error',
      requestPayload: {},
      errorCode: 'unauthorized',
    }).catch((error) => {
      console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    });
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rate = takeRateLimit(`cue:${viewer.uid}`, AI_LIMIT, AI_WINDOW_MS);
  if (!rate.allowed) {
    await recordAiUsageLog({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
      status: 'rate_limited',
      requestPayload: {},
      errorCode: 'local_rate_limit',
    }).catch((error) => {
      console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    });
    return Response.json(
      { error: 'Too many Cue requests. Please wait a few minutes and try again.' },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }
  let body: CueGeminiProxyBody;
  try {
    body = (await req.json()) as CueGeminiProxyBody;
  } catch {
    await recordAiUsageLog({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
      status: 'error',
      requestPayload: {},
      errorCode: 'invalid_json_body',
    }).catch((error) => {
      console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    });
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: rateLimitHeaders(rate) });
  }
  const response = await handleCueGeminiProxy(body);
  const responseJson = (await response
    .clone()
    .json()
    .catch(() => null)) as { text?: string; error?: string } | null;
  const status =
    response.status === 429 ? 'rate_limited' : response.ok ? 'success' : 'error';
  await recordAiUsageLog({
    uid: viewer.uid,
    email: viewer.email,
    authenticated: true,
    provider: 'gemini',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
    status,
    requestPayload: body,
    responseText: typeof responseJson?.text === 'string' ? responseJson.text : '',
    errorCode: typeof responseJson?.error === 'string' ? responseJson.error : null,
  }).catch((error) => {
    console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
  });
  if (process.env.NODE_ENV !== 'production') {
    console.info('[cue-api] route complete', {
      endpoint: '/api/cue',
      uidDetected: true,
      provider: 'gemini',
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-2.0-flash',
      status,
    });
  }
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(rateLimitHeaders(rate))) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
