'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import SaveStudyItemModal from '@/components/study-tools/SaveStudyItemModal';
import { useMirror } from '@/context/mirror-context';
import { formatCueSessionExpiresIn, patchCueStudySessionSaved } from '@/lib/cue-study-session-client';
import type { CueStudyResultPayload } from '@/lib/cue-web';
import { useWebAuth } from '@/lib/firebase-client';
import { saveFlashcardDeck, saveQuiz } from '@/lib/study-tools-client';
import {
  countDecksForFolder,
  countQuizzesForFolder,
  defaultFlashcardDeckTitle,
  defaultQuizTitle,
} from '@/lib/study-tools-save-titles';
import type { NoteFolder } from '@studycue/types';

function resolveFolderId(
  folders: NoteFolder[],
  requestedFolderName?: string | null,
): { folderId: number | null; folderName: string | null } {
  if (!requestedFolderName?.trim()) {
    return { folderId: null, folderName: 'Uncategorized' };
  }
  const match = folders.find(
    (folder) => folder.name.toLowerCase() === requestedFolderName.trim().toLowerCase(),
  );
  if (match) return { folderId: match.id, folderName: match.name };
  return { folderId: null, folderName: requestedFolderName.trim() };
}

function studyToolHref(result: CueStudyResultPayload) {
  const base = result.kind === 'quiz' ? '/app/quiz' : '/app/flashcards';
  return `${base}?sessionId=${encodeURIComponent(result.sessionId)}`;
}

export default function CueStudyResultCard({ result }: { result: CueStudyResultPayload }) {
  const { user } = useWebAuth();
  const { mirror } = useMirror();
  const folders = useMemo(() => mirror.noteFolders ?? [], [mirror.noteFolders]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [savedTargetId, setSavedTargetId] = useState<string | null>(null);

  const folderDefaults = useMemo(
    () => resolveFolderId(folders, result.requestedFolderName),
    [folders, result.requestedFolderName],
  );

  const defaultTitle = useMemo(() => {
    if (result.kind === 'quiz') {
      return defaultQuizTitle({
        folderName: folderDefaults.folderName,
        sourceName: result.sourceName,
        sourceType: 'upload',
        existingCount: countQuizzesForFolder([], folderDefaults.folderId, result.sourceName),
      });
    }
    return defaultFlashcardDeckTitle({
      folderName: folderDefaults.folderName,
      sourceName: result.sourceName,
      sourceType: 'upload',
      existingCount: countDecksForFolder([], folderDefaults.folderId, result.sourceName),
    });
  }, [folderDefaults, result]);

  const href = studyToolHref(result);
  const expiresLabel = formatCueSessionExpiresIn(result.expiresAt);

  async function handleSaved(payload: {
    title: string;
    folderId: number | null;
    folderName: string | null;
  }) {
    if (!user) return;
    if (result.kind === 'quiz') {
      const saved = await saveQuiz(user.uid, {
        title: payload.title,
        sourceName: result.sourceName,
        sourceType: 'upload',
        folderId: payload.folderId,
        folderName: payload.folderName,
        questions: result.questions,
      });
      await patchCueStudySessionSaved(result.sessionId, saved.quizId);
      setSavedTargetId(saved.quizId);
      setSavedNotice('Quiz saved.');
      return;
    }
    const saved = await saveFlashcardDeck(user.uid, {
      title: payload.title,
      sourceName: result.sourceName,
      sourceType: 'upload',
      folderId: payload.folderId,
      folderName: payload.folderName,
      cards: result.cards,
    });
    await patchCueStudySessionSaved(result.sessionId, saved.deckId);
    setSavedTargetId(saved.deckId);
    setSavedNotice('Flashcard deck saved.');
  }

  const title = result.kind === 'quiz' ? 'Quiz created' : 'Flashcards created';
  const countLabel =
    result.kind === 'quiz'
      ? `${result.count} question${result.count === 1 ? '' : 's'}`
      : `${result.count} card${result.count === 1 ? '' : 's'}`;

  return (
    <div className="mt-3 rounded-[14px] border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-text-primary">{title}</p>
      <p className="mt-1 text-xs text-text-secondary">
        {result.sourceName} · {countLabel}
      </p>
      <p className="mt-1 text-[11px] text-text-muted">
        Temporary for 24 hours unless saved · {expiresLabel}
      </p>
      {savedNotice ? <p className="mt-2 text-xs font-semibold text-emerald-700">{savedNotice}</p> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={href} className="sc-btn-primary text-xs">
          {result.kind === 'quiz' ? 'Start quiz' : 'Review cards'}
        </Link>
        {!savedTargetId ? (
          <button type="button" onClick={() => setSaveOpen(true)} className="sc-btn-secondary text-xs">
            {result.kind === 'quiz' ? 'Save quiz' : 'Save deck'}
          </button>
        ) : (
          <Link
            href={
              result.kind === 'quiz'
                ? `/app/quiz?retake=${encodeURIComponent(savedTargetId)}`
                : `/app/flashcards`
            }
            className="sc-btn-secondary text-xs"
          >
            Open saved {result.kind === 'quiz' ? 'quiz' : 'deck'}
          </Link>
        )}
        <Link href={href} className="sc-btn-secondary text-xs">
          Open in {result.kind === 'quiz' ? 'Quiz Generator' : 'Flashcards'}
        </Link>
      </div>

      <SaveStudyItemModal
        open={saveOpen}
        kind={result.kind === 'quiz' ? 'quiz' : 'flashcards'}
        defaultTitle={defaultTitle}
        defaultFolderId={folderDefaults.folderId}
        folders={folders}
        onClose={() => setSaveOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}
