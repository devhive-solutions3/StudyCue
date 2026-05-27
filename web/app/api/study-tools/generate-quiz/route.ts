import {
  parseNumQuestions,
  parseStudySourceBody,
  runStudyToolRequest,
} from '@/lib/study-tools-api-handler';
import { generateQuizFromText } from '@/lib/study-tools-ai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let numQuestions = 10;
  return runStudyToolRequest({
    request,
    endpoint: '/api/study-tools/generate-quiz',
    parseBody: (body) => {
      const count = parseNumQuestions(body);
      if (typeof count === 'string') return count;
      numQuestions = count;
      return parseStudySourceBody(body);
    },
    run: async ({ text }) => {
      const quiz = await generateQuizFromText(text, numQuestions);
      return { quiz };
    },
  });
}
