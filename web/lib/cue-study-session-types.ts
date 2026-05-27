import type { FlashcardItem, QuizQuestion } from '@/lib/study-tools-types';

export type CueStudySessionType = 'quiz' | 'flashcards' | 'file_study';

export type CueStudySessionSourceType = 'cue_attachment' | 'paste' | 'notes' | 'upload';

/** Summary for lists / chat restore (no generated payload). */
export type CueStudySessionSummary = {
  sessionId: string;
  type: CueStudySessionType;
  sourceName: string;
  sourceType: CueStudySessionSourceType;
  title: string;
  itemCount: number;
  createdAt: string;
  expiresAt: string;
  savedAt: string | null;
  savedTargetId: string | null;
  requestedFolderName?: string | null;
};

export type CueStudySessionQuiz = CueStudySessionSummary & {
  type: 'quiz';
  questions: QuizQuestion[];
};

export type CueStudySessionFlashcards = CueStudySessionSummary & {
  type: 'flashcards';
  cards: FlashcardItem[];
};

export type CueStudySessionDetail = CueStudySessionQuiz | CueStudySessionFlashcards;

export const CUE_STUDY_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export const CUE_STUDY_SESSION_EXPIRED_MESSAGE =
  'This temporary study item has expired or cannot be found. Please generate it again from your source.';
