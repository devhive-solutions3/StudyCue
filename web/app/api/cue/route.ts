import { handleCueGeminiProxy, type CueGeminiProxyBody } from '@/lib/ai-proxy-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: CueGeminiProxyBody;
  try {
    body = (await req.json()) as CueGeminiProxyBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  return handleCueGeminiProxy(body);
}
