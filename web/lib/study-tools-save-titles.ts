import type { SavedFlashcardDeck, SavedQuiz, StudySourceType } from '@/lib/study-tools-types';

export function quizFolderId(quiz: Pick<SavedQuiz, 'folderId' | 'noteFolderId'>): number | null {
  return quiz.folderId ?? quiz.noteFolderId ?? null;
}

export function deckFolderId(deck: Pick<SavedFlashcardDeck, 'folderId' | 'noteFolderId'>): number | null {
  return deck.folderId ?? deck.noteFolderId ?? null;
}

export function countQuizzesForFolder(
  quizzes: SavedQuiz[],
  folderId: number | null,
  sourceName?: string | null,
): number {
  return quizzes.filter((row) => {
    const rowFolder = quizFolderId(row);
    if (folderId != null) return rowFolder === folderId;
    if (sourceName?.trim()) {
      return rowFolder == null && row.sourceName === sourceName;
    }
    return rowFolder == null;
  }).length;
}

export function countDecksForFolder(
  decks: SavedFlashcardDeck[],
  folderId: number | null,
  sourceName?: string | null,
): number {
  return decks.filter((row) => {
    const rowFolder = deckFolderId(row);
    if (folderId != null) return rowFolder === folderId;
    if (sourceName?.trim()) {
      return rowFolder == null && row.sourceName === sourceName;
    }
    return rowFolder == null;
  }).length;
}

export function defaultQuizTitle(params: {
  folderName?: string | null;
  sourceName?: string | null;
  sourceType?: StudySourceType;
  existingCount: number;
}): string {
  const next = params.existingCount + 1;
  const folder = params.folderName?.trim();
  const source = params.sourceName?.trim();

  if (folder) return `${folder} Quiz #${next}`;
  if (params.sourceType === 'notes' && source) return `${source} Quiz #${next}`;
  if (source && params.sourceType !== 'paste') return `${source} Quiz #${next}`;
  return `Study Quiz #${next}`;
}

export function defaultFlashcardDeckTitle(params: {
  folderName?: string | null;
  sourceName?: string | null;
  sourceType?: StudySourceType;
  existingCount: number;
}): string {
  const next = params.existingCount + 1;
  const folder = params.folderName?.trim();
  const source = params.sourceName?.trim();

  if (folder) return `${folder} Flashcards #${next}`;
  if (params.sourceType === 'notes' && source) return `${source} Flashcards #${next}`;
  if (source && params.sourceType !== 'paste') return `${source} Flashcards #${next}`;
  return `Study Flashcards #${next}`;
}
