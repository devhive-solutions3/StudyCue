export type CueStudyCommandType = 'quiz' | 'flashcards' | 'both' | 'none';

export type CueStudyCommand = {
  type: CueStudyCommandType;
  count?: number;
  shouldSave?: boolean;
  requestedFolderName?: string | null;
};

export const CUE_STUDY_PLAN_DENIED_MESSAGE =
  'Quiz and Flashcard generation is available for Beta and StudyCue Plus users.';

export const CUE_STUDY_NO_SOURCE_MESSAGE =
  'Attach a file or paste notes first, then I can generate a quiz or flashcards.';

export const CUE_STUDY_BOTH_MESSAGE =
  'Do you want a quiz or flashcards? Say something like “make a 10-question quiz” or “generate 20 flashcards.”';

const QUIZ_PATTERNS = [
  /\bcreate\s+(?:a\s+)?quiz\b/i,
  /\bmake\s+(?:me\s+)?(?:a\s+)?quiz\b/i,
  /\bgenerate\s+(?:a\s+)?quiz\b/i,
  /\bmake\s+(?:me\s+)?\d+\s*(?:item\s+)?questions?\b/i,
  /\b\d+\s*(?:item\s+)?quiz\b/i,
  /\bquiz\s+me\b/i,
  /\bmultiple\s*[- ]?choice\b/i,
  /\b(?:create|make|generate)\s+(?:\d+\s+)?questions?\b/i,
];

const FLASHCARD_PATTERNS = [
  /\bcreate\s+(?:\w+\s+){0,3}flashcards?\b/i,
  /\bmake\s+(?:me\s+)?(?:\w+\s+){0,3}flashcards?\b/i,
  /\bgenerate\s+(?:\w+\s+){0,3}flashcards?\b/i,
  /\bmake\s+(?:me\s+)?(?:\w+\s+){0,3}cards?\b/i,
  /\bactive\s+recall\s+cards?\b/i,
  /\breviewer\s+cards?\b/i,
  /\bflash\s*cards?\b/i,
];

const SAVE_PATTERNS = /\b(save|store)\b/i;
const FOLDER_PATTERNS = [
  /\b(?:under|in|to)\s+(?:my\s+)?["']?([^"'\n.]+?)["']?\s+folder\b/i,
  /\bfolder\s+["']?([^"'\n.]+?)["']?\b/i,
  /\bsave\s+(?:this\s+)?(?:under|in|to)\s+["']?([^"'\n.]+?)["']?/i,
];

function parseCount(message: string, kind: 'quiz' | 'flashcards'): number | undefined {
  const patterns =
    kind === 'quiz'
      ? [
          /\b(\d+)\s*(?:item\s+)?(?:question|quiz)/i,
          /\b(?:question|quiz)\s*(?:of\s+)?(\d+)/i,
          /\bmake\s+(?:me\s+)?(\d+)\s+questions?/i,
        ]
      : [
          /\b(\d+)\s*(?:flash\s*cards?|cards?)/i,
          /\b(?:flash\s*cards?|cards?)\s*(?:of\s+)?(\d+)/i,
          /\bgenerate\s+(\d+)\s+(?:flash\s*cards?|cards?)/i,
        ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match?.[1]) {
      const value = Number.parseInt(match[1], 10);
      if (Number.isFinite(value)) return value;
    }
  }
  return undefined;
}

function clampCount(kind: 'quiz' | 'flashcards', count: number | undefined): number {
  if (kind === 'quiz') {
    const value = count ?? 10;
    return Math.min(30, Math.max(5, Math.round(value)));
  }
  const value = count ?? 20;
  return Math.min(50, Math.max(10, Math.round(value)));
}

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(message));
}

function parseFolderName(message: string): string | null {
  for (const pattern of FOLDER_PATTERNS) {
    const match = message.match(pattern);
    const name = match?.[1]?.trim();
    if (name && name.length >= 2 && name.length <= 80) {
      return name.replace(/\s+folder$/i, '').trim();
    }
  }
  return null;
}

export function detectCueStudyCommand(message: string): CueStudyCommand {
  const trimmed = message.trim();
  if (!trimmed) return { type: 'none' };

  const wantsQuiz = matchesAny(trimmed, QUIZ_PATTERNS);
  const wantsFlashcards = matchesAny(trimmed, FLASHCARD_PATTERNS);

  if (wantsQuiz && wantsFlashcards) {
    return {
      type: 'both',
      shouldSave: SAVE_PATTERNS.test(trimmed),
      requestedFolderName: parseFolderName(trimmed),
    };
  }

  if (wantsQuiz) {
    const raw = parseCount(trimmed, 'quiz');
    return {
      type: 'quiz',
      count: clampCount('quiz', raw),
      shouldSave: SAVE_PATTERNS.test(trimmed),
      requestedFolderName: parseFolderName(trimmed),
    };
  }

  if (wantsFlashcards) {
    const raw = parseCount(trimmed, 'flashcards');
    return {
      type: 'flashcards',
      count: clampCount('flashcards', raw),
      shouldSave: SAVE_PATTERNS.test(trimmed),
      requestedFolderName: parseFolderName(trimmed),
    };
  }

  return { type: 'none' };
}

/** True when pasted message is long enough to use as study source without a file. */
export function messageHasPastedStudySource(message: string, minChars: number): boolean {
  return message.trim().length >= minChars;
}
