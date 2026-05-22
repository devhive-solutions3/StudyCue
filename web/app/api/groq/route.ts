import { handleGroqProxy, type GroqProxyBody } from '@/lib/ai-proxy-server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let body: GroqProxyBody;
  try {
    body = (await req.json()) as GroqProxyBody;
  } catch {
    return Response.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }
  return handleGroqProxy(body);
}
