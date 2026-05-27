'use client';

import Link from 'next/link';

import type { SavedFlashcardDeck, SavedQuiz } from '@/lib/study-tools-types';
import { deckFolderId, quizFolderId } from '@/lib/study-tools-save-titles';
import { setQuizRetakeSession } from '@/lib/study-tools-retake-session';

type Props = {
  folderId: number;
  quizzes: SavedQuiz[];
  decks: SavedFlashcardDeck[];
  onDeleteQuiz: (quizId: string) => void;
  onDeleteDeck: (deckId: string) => void;
};

export default function NotesFolderStudyOutputs({
  folderId,
  quizzes,
  decks,
  onDeleteQuiz,
  onDeleteDeck,
}: Props) {
  const folderQuizzes = quizzes.filter((row) => quizFolderId(row) === folderId);
  const folderDecks = decks.filter((row) => deckFolderId(row) === folderId);

  if (folderQuizzes.length === 0 && folderDecks.length === 0) return null;

  return (
    <div className="mt-6 space-y-4 border-t border-border pt-4">
      {folderQuizzes.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Saved quizzes</p>
          <div className="mt-2 space-y-2">
            {folderQuizzes.map((row) => (
              <div
                key={row.quizId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{row.title}</p>
                  <p className="text-xs text-text-muted">
                    {row.questionCount} questions
                    {row.scoreLastAttempt != null
                      ? ` · Last ${row.scoreLastAttempt}/${row.questionCount}`
                      : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/app/quiz"
                    onClick={() => setQuizRetakeSession(row.quizId)}
                    className="text-xs font-extrabold text-accent"
                  >
                    Retake
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteQuiz(row.quizId)}
                    className="text-xs font-extrabold text-text-muted hover:text-rose-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {folderDecks.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">Saved flashcards</p>
          <div className="mt-2 space-y-2">
            {folderDecks.map((row) => (
              <div
                key={row.deckId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-border bg-surface px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">{row.title}</p>
                  <p className="text-xs text-text-muted">{row.cardCount} cards</p>
                </div>
                <div className="flex gap-2">
                  <Link href="/app/flashcards" className="text-xs font-extrabold text-accent">
                    Review
                  </Link>
                  <button
                    type="button"
                    onClick={() => onDeleteDeck(row.deckId)}
                    className="text-xs font-extrabold text-text-muted hover:text-rose-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
