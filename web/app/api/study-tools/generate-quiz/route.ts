import {
  parseNumQuestions,
  parseStudySourceBody,
  runStudyToolRequest,
} from '@/lib/study-tools-api-handler';
import { generateQuizForUser } from '@/lib/study-tools-server';
import type { StudySourceType } from '@/lib/study-tools-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let numQuestions = 10;
  let sourceType: StudySourceType = 'paste';
  return runStudyToolRequest({
    request,
    endpoint: '/api/study-tools/generate-quiz',
    parseBody: (body) => {
      const count = parseNumQuestions(body);
      if (typeof count === 'string') return count;
      numQuestions = count;
      if (body.sourceType === 'notes' || body.sourceType === 'upload' || body.sourceType === 'paste') {
        sourceType = body.sourceType;
      }
      return parseStudySourceBody(body);
    },
    run: async ({ viewer, text, sourceName, requestId }) => {
      const { quiz, daily } = await generateQuizForUser({
        uid: viewer.uid,
        email: viewer.email,
        text,
        sourceName,
        sourceType,
        numQuestions,
        requestId,
        sourceSurface: sourceType === 'notes' ? 'notes' : 'quiz_page',
      });
      return { data: { quiz }, daily };
    },
  });
}
