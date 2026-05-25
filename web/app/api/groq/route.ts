import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { recordAiUsageLog } from '@/lib/ai-usage-logger';
import { rateLimitHeaders, takeRateLimit } from '@/lib/rate-limit';
import { handleGroqProxy, type GroqProxyBody } from '@/lib/ai-proxy-server';
import { reserveCueRequestUsage } from '@/lib/server-usage-limits';

export const runtime = 'nodejs';
const AI_LIMIT = 20;
const AI_WINDOW_MS = 10 * 60 * 1000;

function logUsageSafely(params: Parameters<typeof recordAiUsageLog>[0]) {
  void recordAiUsageLog(params).catch((error) => {
    console.error('[ai-usage-log-failed]', error instanceof Error ? error.message : error);
    if (process.env.NODE_ENV !== 'production') {
      console.info('[ai-usage-log] aiUsageLogs write fail', {
        endpoint: params.endpoint,
        provider: params.provider,
        status: params.status,
      });
      console.info('[ai-usage-log] daily aggregate update fail', {
        endpoint: params.endpoint,
        provider: params.provider,
        status: params.status,
      });
    }
  });
}

export async function POST(req: Request) {
  const viewer = await requireFirebaseAuth(req);
  if (process.env.NODE_ENV !== 'production') {
    console.info('[cue-api] request received', {
      endpoint: '/api/groq',
      uidDetected: Boolean(viewer?.uid),
    });
  }
  if (!viewer) {
    logUsageSafely({
      uid: 'anonymous',
      email: null,
      authenticated: false,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'error',
      requestPayload: {},
      errorCode: 'unauthorized',
      endpoint: '/api/groq',
    });
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rate = takeRateLimit(`groq:${viewer.uid}`, AI_LIMIT, AI_WINDOW_MS);
  if (!rate.allowed) {
    logUsageSafely({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'rate_limited',
      requestPayload: {},
      errorCode: 'local_rate_limit',
      endpoint: '/api/groq',
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
    logUsageSafely({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'error',
      requestPayload: {},
      errorCode: 'invalid_json_body',
      endpoint: '/api/groq',
    });
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: rateLimitHeaders(rate) });
  }
  const requestId = req.headers.get('x-studycue-request-id');
  const dailyLimit = await reserveCueRequestUsage(viewer.uid, body, requestId);
  if (!dailyLimit.allowed) {
    logUsageSafely({
      uid: viewer.uid,
      email: viewer.email,
      authenticated: true,
      provider: 'groq',
      model: process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
      status: 'rate_limited',
      requestPayload: body,
      errorCode:
        dailyLimit.scheduleImage?.reason === 'schedule_image_monthly'
          ? 'schedule_image_import_limit'
          : 'cue_daily_limit',
      endpoint: '/api/groq',
    });
    return Response.json(
      {
        error: dailyLimit.message,
        limit:
          dailyLimit.scheduleImage?.reason === 'schedule_image_monthly'
            ? dailyLimit.scheduleImage.limit
            : dailyLimit.daily.limit,
        used:
          dailyLimit.scheduleImage?.reason === 'schedule_image_monthly'
            ? dailyLimit.scheduleImage.used
            : dailyLimit.daily.used,
        resetAt:
          dailyLimit.scheduleImage?.reason === 'schedule_image_monthly'
            ? dailyLimit.scheduleImage.resetAt
            : dailyLimit.daily.resetAt,
      },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }
  const response = await handleGroqProxy(body);
  const responseJson = (await response
    .clone()
    .json()
    .catch(() => null)) as { text?: string; error?: string } | null;
  const status =
    response.status === 429 ? 'rate_limited' : response.ok ? 'success' : 'error';
  logUsageSafely({
    uid: viewer.uid,
    email: viewer.email,
    authenticated: true,
    provider: 'groq',
    model: body.model?.trim() || process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile',
    status,
    requestPayload: body,
    responseText: typeof responseJson?.text === 'string' ? responseJson.text : '',
    errorCode: typeof responseJson?.error === 'string' ? responseJson.error : null,
    endpoint: '/api/groq',
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
  headers.set('x-studycue-cue-daily-limit', String(dailyLimit.daily.limit));
  headers.set('x-studycue-cue-daily-used', String(dailyLimit.daily.used));
  headers.set('x-studycue-cue-daily-reset-at', dailyLimit.daily.resetAt);
  if (dailyLimit.scheduleImage) {
    headers.set(
      'x-studycue-schedule-import-limit',
      String(dailyLimit.scheduleImage.limit),
    );
    headers.set(
      'x-studycue-schedule-import-used',
      String(dailyLimit.scheduleImage.used),
    );
    headers.set(
      'x-studycue-schedule-import-reset-at',
      dailyLimit.scheduleImage.resetAt,
    );
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
