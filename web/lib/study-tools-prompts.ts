const MAX_NUMBERED_LINES = 1_500;
const SECTION_CHUNK_CHARS = 450;

/** Number source for citations without exploding payload on PDFs with a line per word. */
export function buildNumberedSourceText(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length <= MAX_NUMBERED_LINES) {
    return lines.map((line, index) => `[Line ${index + 1}] ${line}`).join('\n');
  }

  const sections: string[] = [];
  let current = '';
  for (const line of lines) {
    const piece = line.trim();
    if (!piece) continue;
    const candidate = current ? `${current} ${piece}` : piece;
    if (candidate.length > SECTION_CHUNK_CHARS && current) {
      sections.push(current);
      current = piece;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) sections.push(current.trim());

  return sections.map((section, index) => `[Section ${index + 1}] ${section}`).join('\n\n');
}

export function buildQuizPrompt(numQuestions: number): string {
  return `You are a study assistant. Use ONLY the numbered source text below. Do not use outside knowledge.

Return strict JSON only (no markdown fences):
{
  "quiz": [
    {
      "question": "string",
      "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
      "correctAnswer": "exact text of the correct option including the A)/B)/C)/D) prefix",
      "citation": "quote from source with [Line N] reference"
    }
  ]
}

Rules:
- Generate exactly ${numQuestions} multiple-choice questions.
- Each question must have exactly 4 options labeled A) B) C) D).
- correctAnswer must match one option exactly.
- Every question needs a citation quoting the source with a [Line N] tag.
- Vary difficulty when the source supports it.

SOURCE:
`;
}

export function buildFlashcardPrompt(numCards: number): string {
  return `You are a study assistant. Use ONLY the numbered source text below. Do not use outside knowledge.

Return strict JSON only (no markdown fences):
{
  "flashcards": [
    {
      "front": "question, term, or prompt",
      "back": "answer or explanation",
      "citation": "exact quote with [Line N] reference"
    }
  ]
}

Rules:
- Generate exactly ${numCards} flashcards for active recall.
- Concise front, clear back.
- Mix definitions, concepts, processes, and comparisons when supported.
- Every card must include a citation with [Line N].
- Do not invent facts not in the source.

SOURCE:
`;
}

export function buildFileStudyPrompt(): string {
  return `You are a study assistant. Use ONLY the numbered source text below. Do not use outside knowledge.

Return strict JSON only (no markdown fences):
{
  "summary": "2-4 sentence overview",
  "keyPoints": ["bullet point", "..."],
  "keyTerms": [{ "term": "...", "definition": "..." }],
  "suggestedReviewQuestions": ["question", "..."]
}

Rules:
- keyPoints: 5-10 items when possible.
- keyTerms: up to 12 important terms.
- suggestedReviewQuestions: 5-8 study questions.
- Ground everything in the source only.

SOURCE:
`;
}
