import {
  parseNumCards,
  parseStudySourceBody,
  runStudyToolRequest,
} from '@/lib/study-tools-api-handler';
import { generateFlashcardsForUser } from '@/lib/study-tools-server';
import type { StudySourceType } from '@/lib/study-tools-types';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let numCards = 10;
  let sourceType: StudySourceType = 'paste';
  return runStudyToolRequest({
    request,
    endpoint: '/api/study-tools/generate-flashcards',
    parseBody: (body) => {
      const count = parseNumCards(body);
      if (typeof count === 'string') return count;
      numCards = count;
      if (body.sourceType === 'notes' || body.sourceType === 'upload' || body.sourceType === 'paste') {
        sourceType = body.sourceType;
      }
      return parseStudySourceBody(body);
    },
    run: async ({ viewer, text, sourceName, requestId }) => {
      const { flashcards, daily } = await generateFlashcardsForUser({
        uid: viewer.uid,
        email: viewer.email,
        text,
        sourceName,
        sourceType,
        numCards,
        requestId,
        sourceSurface: sourceType === 'notes' ? 'notes' : 'flashcards_page',
      });
      return { data: { flashcards }, daily };
    },
  });
}
