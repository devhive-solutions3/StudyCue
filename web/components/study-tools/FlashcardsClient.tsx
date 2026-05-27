'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import SaveStudyItemModal from '@/components/study-tools/SaveStudyItemModal';
import StudySourcePicker from '@/components/study-tools/StudySourcePicker';
import { useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';
import { readStudySourceFromSession, saveStudySourceToSession } from '@/lib/study-source-session';
import { studyGenerateBlockedMessage } from '@/lib/study-source-validation';
import {
  listFlashcardDecks,
  saveFlashcardDeck,
  updateFlashcardDeckProgress,
} from '@/lib/study-tools-client';
import {
  countDecksForFolder,
  defaultFlashcardDeckTitle,
} from '@/lib/study-tools-save-titles';
import type { FlashcardItem, SavedFlashcardDeck, StudySourceSelection } from '@/lib/study-tools-types';
import { hasReadyStudySource } from '@/lib/study-tools-types';
import { FLASHCARD_COUNT_OPTIONS } from '@/lib/study-tools-types';

export default function FlashcardsClient() {
  const { user } = useWebAuth();
  const { mirror, commitMirror } = useMirror();
  const folders = mirror.noteFolders ?? [];

  const [source, setSource] = useState<StudySourceSelection | null>(() => readStudySourceFromSession());
  const [uploadPending, setUploadPending] = useState(false);
  const [numCards, setNumCards] = useState(10);
  const [cards, setCards] = useState<FlashcardItem[] | null>(null);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const [review, setReview] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deckId, setDeckId] = useState<string | null>(null);
  const [allDecks, setAllDecks] = useState<SavedFlashcardDeck[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDefaults, setSaveDefaults] = useState({ title: '', folderId: null as number | null });

  useEffect(() => {
    if (!user) return;
    void listFlashcardDecks(user.uid).then(setAllDecks);
  }, [user]);

  function handleSourceReady(selection: StudySourceSelection | null) {
    setSource(selection);
    if (selection?.text.trim()) setError(null);
  }

  async function generateDeck() {
    const blocked = studyGenerateBlockedMessage({ source, uploadPending });
    if (blocked) {
      setError(blocked);
      return;
    }
    if (!hasReadyStudySource(source)) {
      setError('Choose a source first.');
      return;
    }
    const readySource = source;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/study-tools/generate-flashcards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          text: readySource.text,
          sourceName: readySource.sourceName,
          sourceType: readySource.sourceType,
          numCards,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        flashcards?: FlashcardItem[];
      } | null;
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const next = payload?.flashcards ?? [];
      setCards(next);
      setIndex(0);
      setFlipped(false);
      setKnown(0);
      setReview(next.length);
      setDeckId(null);
      saveStudySourceToSession(readySource);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate flashcards.');
    } finally {
      setLoading(false);
    }
  }

  function openSaveModal() {
    if (!user || !cards) return;
    const defaultFolderId = source?.folderId ?? source?.noteFolderId ?? null;
    const folderName =
      source?.folderName ??
      folders.find((folder) => folder.id === defaultFolderId)?.name ??
      null;
    const existingCount = countDecksForFolder(allDecks, defaultFolderId, source?.sourceName);
    setSaveDefaults({
      title: defaultFlashcardDeckTitle({
        folderName,
        sourceName: source?.sourceName,
        sourceType: source?.sourceType,
        existingCount,
      }),
      folderId: defaultFolderId,
    });
    setSaveOpen(true);
  }

  async function handleSaveToFolder(payload: {
    title: string;
    folderId: number | null;
    folderName: string | null;
  }) {
    if (!user || !cards || !source) return;
    const row = await saveFlashcardDeck(user.uid, {
      title: payload.title,
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      folderId: payload.folderId,
      folderName: payload.folderName,
      noteFileId: source.noteFileId ?? null,
      cards,
    });
    setDeckId(row.deckId);
    setAllDecks(await listFlashcardDecks(user.uid));
  }

  function markKnown(isKnown: boolean) {
    if (!cards) return;
    if (isKnown) setKnown((value) => value + 1);
    else setReview((value) => Math.max(0, value - 1));
    setFlipped(false);
    setIndex((value) => Math.min(value + 1, cards.length - 1));
    if (user && deckId) {
      void updateFlashcardDeckProgress(user.uid, deckId, known + (isKnown ? 1 : 0), review);
    }
  }

  const current = cards?.[index];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Study tools</p>
        <h1 className="mt-1 text-3xl font-semibold text-text-primary">Flashcards</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Turn notes into active-recall cards. Saved decks appear in your Notes folders.
        </p>
      </div>

      {!cards ? (
        <>
          <StudySourcePicker
            source={source}
            onSourceReady={handleSourceReady}
            onUploadPendingChange={setUploadPending}
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-text-secondary">Cards</span>
              <select
                value={numCards}
                onChange={(e) => setNumCards(Number(e.target.value))}
                className="sc-input mt-1"
              >
                {FLASHCARD_COUNT_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void generateDeck()}
              className="sc-btn-primary disabled:opacity-60"
            >
              {loading ? 'Generating…' : 'Generate flashcards'}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4 rounded-[16px] border border-border bg-surface p-6 text-center">
          <p className="text-xs text-text-muted">
            Card {index + 1} of {cards.length} · Known {known} · Review {review}
          </p>
          <button
            type="button"
            onClick={() => setFlipped((value) => !value)}
            className="mx-auto min-h-[180px] w-full max-w-lg rounded-[20px] border border-border bg-surface-2 p-6 text-left"
          >
            <p className="text-lg font-semibold text-text-primary">
              {flipped && current ? current.back : current?.front}
            </p>
            {flipped && current ? (
              <p className="mt-4 text-xs text-text-muted">{current.citation}</p>
            ) : (
              <p className="mt-4 text-xs text-text-muted">Tap to reveal answer</p>
            )}
          </button>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => markKnown(true)} className="sc-btn-primary">
              Known
            </button>
            <button type="button" onClick={() => markKnown(false)} className="sc-btn-secondary">
              Review
            </button>
            <button
              type="button"
              onClick={() => setIndex((value) => Math.max(0, value - 1))}
              className="sc-btn-secondary"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setIndex((value) => Math.min(cards.length - 1, value + 1))}
              className="sc-btn-secondary"
            >
              Next
            </button>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={openSaveModal} className="sc-btn-secondary">
              Save deck
            </button>
            <button type="button" onClick={() => setCards(null)} className="sc-btn-secondary">
              New deck
            </button>
          </div>
        </div>
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <Link href="/app/notes" className="text-sm font-semibold text-text-secondary">
        Open Notes to study files or view saved decks →
      </Link>

      <SaveStudyItemModal
        open={saveOpen}
        kind="flashcards"
        defaultTitle={saveDefaults.title}
        defaultFolderId={saveDefaults.folderId}
        folders={folders}
        onClose={() => setSaveOpen(false)}
        onSaved={handleSaveToFolder}
        onFolderCreated={(folder) => {
          commitMirror((prev) => ({
            ...prev,
            noteFolders: [...(prev.noteFolders ?? []), folder],
          }));
        }}
      />
    </div>
  );
}
