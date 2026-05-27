'use client';

import type { FlashcardItem, QuizQuestion } from '@/lib/study-tools-types';

const QUIZ_KEY = 'studycue_cue_quiz_v1';
const DECK_KEY = 'studycue_cue_deck_v1';
const MAX_AGE_MS = 60 * 60 * 1000;

export type CueGeneratedQuiz = {
  sourceName: string;
  sourceType: 'paste' | 'upload';
  questions: QuizQuestion[];
  requestedFolderName?: string | null;
  savedAt: number;
};

export type CueGeneratedDeck = {
  sourceName: string;
  sourceType: 'paste' | 'upload';
  cards: FlashcardItem[];
  requestedFolderName?: string | null;
  savedAt: number;
};

export function saveCueGeneratedQuiz(payload: Omit<CueGeneratedQuiz, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    QUIZ_KEY,
    JSON.stringify({ ...payload, savedAt: Date.now() } satisfies CueGeneratedQuiz),
  );
}

export function readCueGeneratedQuiz(): CueGeneratedQuiz | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(QUIZ_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CueGeneratedQuiz;
    if (!parsed?.questions?.length || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(QUIZ_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCueGeneratedQuiz() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(QUIZ_KEY);
}

export function saveCueGeneratedDeck(payload: Omit<CueGeneratedDeck, 'savedAt'>) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(
    DECK_KEY,
    JSON.stringify({ ...payload, savedAt: Date.now() } satisfies CueGeneratedDeck),
  );
}

export function readCueGeneratedDeck(): CueGeneratedDeck | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(DECK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CueGeneratedDeck;
    if (!parsed?.cards?.length || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(DECK_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCueGeneratedDeck() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(DECK_KEY);
}
