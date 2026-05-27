export function buildNumberedSourceText(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return lines.map((line, index) => `[Line ${index + 1}] ${line}`).join('\n');
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
