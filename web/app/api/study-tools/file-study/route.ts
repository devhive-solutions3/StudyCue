import { parseStudySourceBody, runStudyToolRequest } from '@/lib/study-tools-api-handler';
import { generateFileStudyFromText } from '@/lib/study-tools-ai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return runStudyToolRequest({
    request,
    endpoint: '/api/study-tools/file-study',
    parseBody: (body) => parseStudySourceBody(body),
    run: async ({ text }) => generateFileStudyFromText(text),
  });
}
