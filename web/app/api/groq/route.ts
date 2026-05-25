import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { recordAiUsageLog } from '@/lib/admin-data';
import { rateLimitHeaders, takeRateLimit } from '@/lib/rate-limit';
import { handleGroqProxy, type GroqProxyBody } from '@/lib/ai-proxy-server';

export const runtime = 'nodejs';
const AI_LIMIT = 20;
const AI_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const viewer = await requireFirebaseAuth(req);
  if (process.env.NODE_ENV !== 'production') {
    console.info('[cue-api] request received', {
      endpoint: '/api/groq',
      uidDetected: Boolean(viewer?.uid),
    });
  }
  if (!viewer) {
    await recordAiUsageLog({
      uid: 'anonymous',
      email: null,
      authenticated: false,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'error',
      requestPayload: {},
      errorCode: 'unauthorized',
    }).catch((error) => {
      console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    });
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rate = takeRateLimit(`groq:${viewer.uid}`, AI_LIMIT, AI_WINDOW_MS);
  if (!rate.allowed) {
    await recordAiUsageLog({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'rate_limited',
      requestPayload: {},
      errorCode: 'local_rate_limit',
    }).catch((error) => {
      console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    });
    return Response.json(
      { error: 'Too many AI requests. Please wait a few minutes and try again.' },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }
  let body: GroqProxyBody;
  try {
    body = (await req.json()) as GroqProxyBody;
  } catch {
    await recordAiUsageLog({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'error',
      requestPayload: {},
      errorCode: 'invalid_json_body',
    }).catch((error) => {
      console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    });
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: rateLimitHeaders(rate) });
  }
  const response = await handleGroqProxy(body);
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
    provider: 'groq',
    model: body.model?.trim() || process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    status,
    requestPayload: body,
    responseText: typeof responseJson?.text === 'string' ? responseJson.text : '',
    errorCode: typeof responseJson?.error === 'string' ? responseJson.error : null,
  }).catch((error) => {
    console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
  });
  if (process.env.NODE_ENV !== 'production') {
    console.info('[cue-api] route complete', {
      endpoint: '/api/groq',
      uidDetected: true,
      provider: 'groq',
      model: body.model?.trim() || process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
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
