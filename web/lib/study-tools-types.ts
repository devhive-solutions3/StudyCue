export type StudySourceType = 'paste' | 'upload' | 'notes';

export type StudySourceSelection = {
  sourceType: StudySourceType;
  sourceName: string;
  text: string;
  fileType?: string;
  fileSizeBytes?: number;
  noteFileId?: number;
  /** @deprecated use folderId */
  noteFolderId?: number;
  folderId?: number;
  folderName?: string;
  noteStoragePath?: string;
};

/** Minimum extracted characters required before quiz / flashcard generation. */
export const STUDY_SOURCE_MIN_CHARS = 100;

/** UI / API-facing quiz question (labeled options for display). */
export type QuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  citation: string;
};

/** Compact Firestore question: q=question, o=option texts, a=correct index, c=citation */
export type CompactQuizQuestionStored = {
  q: string;
  o: string[];
  a: number;
  c: string;
};

/** UI / API-facing flashcard */
export type FlashcardItem = {
  front: string;
  back: string;
  citation: string;
};

/** Compact Firestore flashcard: f=front, b=back, c=citation */
export type CompactFlashcardStored = {
  f: string;
  b: string;
  c: string;
};

export type FileStudyResult = {
  summary: string;
  keyPoints: string[];
  keyTerms: Array<{ term: string; definition: string }>;
  suggestedReviewQuestions: string[];
};

export type SavedQuiz = {
  quizId: string;
  uid: string;
  title: string;
  sourceName: string;
  sourceType: StudySourceType;
  folderId?: number | null;
  folderName?: string | null;
  noteFileId?: number | null;
  /** @deprecated use folderId */
  noteFolderId?: number | null;
  /** 2 = compact q/o/a/c questions in Firestore */
  schemaVersion?: number;
  questionCount: number;
  /** Expanded for UI after load; stored compact in Firestore when schemaVersion is 2 */
  questions: QuizQuestion[];
  scoreLastAttempt: number | null;
  attemptsCount: number;
  createdAt: string;
  updatedAt: string;
  lastTakenAt: string | null;
};

export type SavedFlashcardDeck = {
  deckId: string;
  uid: string;
  title: string;
  sourceName: string;
  sourceType: StudySourceType;
  folderId?: number | null;
  folderName?: string | null;
  noteFileId?: number | null;
  /** @deprecated use folderId */
  noteFolderId?: number | null;
  /** 2 = compact f/b/c cards in Firestore */
  schemaVersion?: number;
  cardCount: number;
  /** Expanded for UI after load */
  cards: FlashcardItem[];
  knownCount: number;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
  lastReviewedAt: string | null;
};

export const STUDY_SOURCE_MAX_CHARS = 60_000;

export function hasReadyStudySource(
  source: StudySourceSelection | null | undefined,
): source is StudySourceSelection {
  return Boolean(source?.text.trim());
}
export const QUIZ_QUESTION_OPTIONS = [5, 10, 15, 20, 30] as const;
export const FLASHCARD_COUNT_OPTIONS = [10, 20, 30, 50] as const;
