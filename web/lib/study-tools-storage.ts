import type {
  CompactFlashcardStored,
  CompactQuizQuestionStored,
  FlashcardItem,
  QuizQuestion,
} from '@/lib/study-tools-types';

export const STUDY_TOOLS_STORAGE_SCHEMA_VERSION = 2;

const OPTION_LABELS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;

/** Strip leading "A) " style labels for comparison and storage. */
export function stripQuizOptionLabel(option: string): string {
  return option.replace(/^[A-F]\)\s*/i, '').trim();
}

function labelOption(index: number, text: string): string {
  const label = OPTION_LABELS[index] ?? String.fromCharCode(65 + index);
  return `${label}) ${text}`;
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function isCompactQuizItem(value: unknown): value is CompactQuizQuestionStored {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.q === 'string' && Array.isArray(row.o) && typeof row.a === 'number';
}

function isLegacyQuizItem(value: unknown): value is QuizQuestion {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.question === 'string' && Array.isArray(row.options);
}

function resolveCorrectIndex(optionTexts: string[], correctAnswer: string): number {
  const correctText = stripQuizOptionLabel(correctAnswer);
  const byText = optionTexts.findIndex((text) => text === correctText);
  if (byText >= 0) return byText;

  const letterMatch = correctAnswer.trim().match(/^([A-F])\)/i);
  if (letterMatch) {
    const letterIndex = letterMatch[1]!.toUpperCase().charCodeAt(0) - 65;
    if (letterIndex >= 0 && letterIndex < optionTexts.length) return letterIndex;
  }

  return 0;
}

/** Normalize API or legacy quiz rows into UI-friendly questions (labeled options). */
export function normalizeGeneratedQuiz(raw: unknown): QuizQuestion[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): QuizQuestion | null => {
      if (isCompactQuizItem(item)) {
        return expandCompactQuizQuestion(item);
      }
      if (!isLegacyQuizItem(item)) return null;

      const optionTexts = item.options.map((option) => stripQuizOptionLabel(String(option)));
      const correctIndex = resolveCorrectIndex(optionTexts, String(item.correctAnswer ?? ''));
      const labeledOptions = optionTexts.map((text, index) => labelOption(index, text));

      return {
        question: String(item.question).trim(),
        options: labeledOptions,
        correctAnswer: labeledOptions[correctIndex] ?? labeledOptions[0] ?? '',
        citation: String(item.citation ?? '').trim(),
      };
    })
    .filter((row): row is QuizQuestion => Boolean(row?.question && row.options.length > 0));
}

export function compactQuizForStorage(questions: QuizQuestion[]): CompactQuizQuestionStored[] {
  return questions.map((question) => {
    const optionTexts = question.options.map(stripQuizOptionLabel);
    const correctIndex = resolveCorrectIndex(optionTexts, question.correctAnswer);
    return {
      q: question.question.trim(),
      o: optionTexts,
      a: correctIndex >= 0 && correctIndex < optionTexts.length ? correctIndex : 0,
      c: question.citation.trim(),
    };
  });
}

export function expandCompactQuizQuestion(stored: CompactQuizQuestionStored): QuizQuestion {
  const labeledOptions = stored.o.map((text, index) => labelOption(index, text));
  const safeIndex =
    stored.a >= 0 && stored.a < labeledOptions.length ? stored.a : 0;
  return {
    question: stored.q,
    options: labeledOptions,
    correctAnswer: labeledOptions[safeIndex] ?? labeledOptions[0] ?? '',
    citation: stored.c,
  };
}

/** Expand compact or legacy stored question arrays for UI. */
export function expandQuizQuestionsFromStorage(stored: unknown): QuizQuestion[] {
  if (!Array.isArray(stored) || stored.length === 0) return [];

  if (isCompactQuizItem(stored[0])) {
    return (stored as CompactQuizQuestionStored[]).map(expandCompactQuizQuestion);
  }

  return normalizeGeneratedQuiz(stored);
}

export function expandQuizForUi<T extends { questions?: unknown }>(storedQuiz: T): T & {
  questions: QuizQuestion[];
} {
  return {
    ...storedQuiz,
    questions: expandQuizQuestionsFromStorage(storedQuiz.questions),
  };
}

function shuffleQuestionOptions(question: QuizQuestion): QuizQuestion {
  const optionTexts = question.options.map(stripQuizOptionLabel);
  const correctText = stripQuizOptionLabel(question.correctAnswer);
  const shuffledTexts = shuffleArray(optionTexts);
  const labeledOptions = shuffledTexts.map((text, index) => labelOption(index, text));
  const correctIndex = shuffledTexts.findIndex((text) => text === correctText);
  const safeIndex = correctIndex >= 0 ? correctIndex : 0;

  return {
    question: question.question,
    options: labeledOptions,
    correctAnswer: labeledOptions[safeIndex] ?? labeledOptions[0] ?? '',
    citation: question.citation,
  };
}

/** Randomize question/option order for retake; does not mutate stored quiz document. */
export function shuffleQuizForAttempt(storedQuiz: { questions: QuizQuestion[] }): QuizQuestion[] {
  return shuffleArray(storedQuiz.questions).map(shuffleQuestionOptions);
}

/** @deprecated Use shuffleQuizForAttempt */
export function shuffleQuestionsForAttempt(questions: QuizQuestion[]): QuizQuestion[] {
  return shuffleQuizForAttempt({ questions });
}

export function normalizeGeneratedFlashcards(raw: unknown): FlashcardItem[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item): FlashcardItem | null => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Record<string, unknown>;
      if (typeof row.f === 'string' && typeof row.b === 'string') {
        return {
          front: row.f.trim(),
          back: row.b.trim(),
          citation: String(row.c ?? '').trim(),
        };
      }
      if (typeof row.front === 'string' && typeof row.back === 'string') {
        return {
          front: row.front.trim(),
          back: row.back.trim(),
          citation: String(row.citation ?? '').trim(),
        };
      }
      return null;
    })
    .filter((row): row is FlashcardItem => Boolean(row?.front && row?.back));
}

export function compactFlashcardsForStorage(cards: FlashcardItem[]): CompactFlashcardStored[] {
  return cards.map((card) => ({
    f: card.front.trim(),
    b: card.back.trim(),
    c: card.citation.trim(),
  }));
}

export function expandFlashcardsFromStorage(stored: unknown): FlashcardItem[] {
  if (!Array.isArray(stored) || stored.length === 0) return [];

  const first = stored[0];
  if (first && typeof first === 'object' && 'f' in (first as Record<string, unknown>)) {
    return (stored as CompactFlashcardStored[]).map((card) => ({
      front: card.f,
      back: card.b,
      citation: card.c,
    }));
  }

  return normalizeGeneratedFlashcards(stored);
}

export function expandDeckForUi<T extends { cards?: unknown }>(storedDeck: T): T & {
  cards: FlashcardItem[];
} {
  return {
    ...storedDeck,
    cards: expandFlashcardsFromStorage(storedDeck.cards),
  };
}

/** Firestore payload for quiz document (compact questions, no source text). */
export function quizDocumentForFirestore(params: {
  quizId: string;
  uid: string;
  title: string;
  sourceName: string;
  sourceType: string;
  folderId: number | null;
  folderName: string | null;
  noteFileId: number | null;
  noteFolderId: number | null;
  questions: QuizQuestion[];
  scoreLastAttempt: number | null;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
  lastTakenAt: string | null;
}) {
  return {
    quizId: params.quizId,
    uid: params.uid,
    title: params.title,
    sourceName: params.sourceName,
    sourceType: params.sourceType,
    folderId: params.folderId,
    folderName: params.folderName,
    noteFileId: params.noteFileId,
    noteFolderId: params.noteFolderId,
    questionCount: params.questions.length,
    schemaVersion: STUDY_TOOLS_STORAGE_SCHEMA_VERSION,
    questions: compactQuizForStorage(params.questions),
    scoreLastAttempt: params.scoreLastAttempt,
    attemptsCount: params.attemptsCount,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    lastTakenAt: params.lastTakenAt,
  };
}

export function flashcardDeckDocumentForFirestore(params: {
  deckId: string;
  uid: string;
  title: string;
  sourceName: string;
  sourceType: string;
  folderId: number | null;
  folderName: string | null;
  noteFileId: number | null;
  noteFolderId: number | null;
  cards: FlashcardItem[];
  knownCount: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
}) {
  return {
    deckId: params.deckId,
    uid: params.uid,
    title: params.title,
    sourceName: params.sourceName,
    sourceType: params.sourceType,
    folderId: params.folderId,
    folderName: params.folderName,
    noteFileId: params.noteFileId,
    noteFolderId: params.noteFolderId,
    cardCount: params.cards.length,
    schemaVersion: STUDY_TOOLS_STORAGE_SCHEMA_VERSION,
    cards: compactFlashcardsForStorage(params.cards),
    knownCount: params.knownCount,
    reviewCount: params.reviewCount,
    createdAt: params.createdAt,
    updatedAt: params.updatedAt,
    lastReviewedAt: params.lastReviewedAt,
  };
}
