import { requireFirebaseAuth } from '@/lib/firebase-server-auth';
import { rateLimitHeaders, takeRateLimit } from '@/lib/rate-limit';
import { handleGroqProxy, type GroqProxyBody } from '@/lib/ai-proxy-server';

export const runtime = 'nodejs';
const AI_LIMIT = 20;
const AI_WINDOW_MS = 10 * 60 * 1000;

export async function POST(req: Request) {
  const viewer = await requireFirebaseAuth(req);
  if (!viewer) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const rate = takeRateLimit(`groq:${viewer.uid}`, AI_LIMIT, AI_WINDOW_MS);
  if (!rate.allowed) {
    return Response.json(
      { error: 'Too many AI requests. Please wait a few minutes and try again.' },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }
  let body: GroqProxyBody;
  try {
    body = (await req.json()) as GroqProxyBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400, headers: rateLimitHeaders(rate) });
  }
  const response = await handleGroqProxy(body);
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
