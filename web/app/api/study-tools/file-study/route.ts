import { parseStudySourceBody, runStudyToolRequest } from '@/lib/study-tools-api-handler';
import { generateFileStudyForUser } from '@/lib/study-tools-server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return runStudyToolRequest({
    request,
    endpoint: '/api/study-tools/file-study',
    parseBody: (body) => parseStudySourceBody(body),
    run: async ({ viewer, text, sourceName, requestId }) => {
      const { result, daily } = await generateFileStudyForUser({
        uid: viewer.uid,
        email: viewer.email,
        text,
        sourceName,
        sourceType: 'paste',
        requestId,
      });
      return { data: result, daily };
    },
  });
}
