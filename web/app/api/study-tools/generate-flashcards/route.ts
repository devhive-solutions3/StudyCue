import {
  parseNumCards,
  parseStudySourceBody,
  runStudyToolRequest,
} from '@/lib/study-tools-api-handler';
import { generateFlashcardsFromText } from '@/lib/study-tools-ai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let numCards = 10;
  return runStudyToolRequest({
    request,
    endpoint: '/api/study-tools/generate-flashcards',
    parseBody: (body) => {
      const count = parseNumCards(body);
      if (typeof count === 'string') return count;
      numCards = count;
      return parseStudySourceBody(body);
    },
    run: async ({ text }) => {
      const flashcards = await generateFlashcardsFromText(text, numCards);
      return { flashcards };
    },
  });
}
