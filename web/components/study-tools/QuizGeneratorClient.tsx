'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import SaveStudyItemModal from '@/components/study-tools/SaveStudyItemModal';
import StudySourcePicker from '@/components/study-tools/StudySourcePicker';
import { useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';
import { readStudySourceFromSession, saveStudySourceToSession } from '@/lib/study-source-session';
import { studyGenerateBlockedMessage } from '@/lib/study-source-validation';
import {
  getSavedQuiz,
  listSavedQuizzes,
  saveQuiz,
  updateQuizAttempt,
} from '@/lib/study-tools-client';
import { consumeQuizRetakeSession } from '@/lib/study-tools-retake-session';
import { shuffleQuizForAttempt } from '@/lib/study-tools-storage';
import {
  countQuizzesForFolder,
  defaultQuizTitle,
} from '@/lib/study-tools-save-titles';
import type { QuizQuestion, SavedQuiz, StudySourceSelection } from '@/lib/study-tools-types';
import { hasReadyStudySource } from '@/lib/study-tools-types';
import { QUIZ_QUESTION_OPTIONS } from '@/lib/study-tools-types';

export default function QuizGeneratorClient() {
  const searchParams = useSearchParams();
  const { user } = useWebAuth();
  const { mirror, commitMirror } = useMirror();
  const folders = mirror.noteFolders ?? [];

  const [source, setSource] = useState<StudySourceSelection | null>(() =>
    readStudySourceFromSession(),
  );
  const [uploadPending, setUploadPending] = useState(false);
  const [numQuestions, setNumQuestions] = useState(10);
  const storedQuestionsRef = useRef<QuizQuestion[] | null>(null);
  const [attemptQuestions, setAttemptQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDefaults, setSaveDefaults] = useState({ title: '', folderId: null as number | null });
  const [allQuizzes, setAllQuizzes] = useState<SavedQuiz[]>([]);

  const quiz = attemptQuestions;

  useEffect(() => {
    if (!user) return;
    void listSavedQuizzes(user.uid).then(setAllQuizzes);
  }, [user]);

  function beginRetake(row: SavedQuiz) {
    storedQuestionsRef.current = row.questions;
    setAttemptQuestions(shuffleQuizForAttempt(row));
    setActiveSavedId(row.quizId);
    setSource({
      sourceType: row.sourceType,
      sourceName: row.sourceName,
      text: '',
      folderId: row.folderId ?? row.noteFolderId ?? undefined,
      noteFolderId: row.noteFolderId ?? row.folderId ?? undefined,
      folderName: row.folderName ?? undefined,
      noteFileId: row.noteFileId ?? undefined,
    });
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
    setError(null);
  }

  useEffect(() => {
    if (!user) return;
    const retakeId = searchParams.get('retake') ?? consumeQuizRetakeSession();
    if (!retakeId) return;

    void (async () => {
      const row = await getSavedQuiz(user.uid, retakeId);
      if (!row) {
        setError('Saved quiz not found.');
        return;
      }
      beginRetake(row);
    })();
  }, [user, searchParams]);

  function resetAttemptState() {
    storedQuestionsRef.current = null;
    setAttemptQuestions(null);
    setActiveSavedId(null);
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  function handleSourceReady(selection: StudySourceSelection | null) {
    setSource(selection);
    if (selection?.text.trim()) setError(null);
  }

  async function generateQuiz() {
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
    resetAttemptState();
    try {
      const response = await fetch('/api/study-tools/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          text: readySource.text,
          sourceName: readySource.sourceName,
          sourceType: readySource.sourceType,
          numQuestions,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        quiz?: QuizQuestion[];
      } | null;
      if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
      const generated = payload?.quiz ?? [];
      storedQuestionsRef.current = generated;
      setAttemptQuestions(generated);
      saveStudySourceToSession(readySource);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not generate quiz.');
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer(option: string) {
    if (!quiz || finished) return;
    const current = quiz[index];
    setSelected(option);
    if (option.trim() === current.correctAnswer.trim()) setScore((value) => value + 1);
    if (index >= quiz.length - 1) setFinished(true);
  }

  function nextQuestion() {
    if (!quiz || finished) return;
    setIndex((value) => value + 1);
    setSelected(null);
  }

  function openSaveModal() {
    if (!user || !storedQuestionsRef.current) return;
    const defaultFolderId =
      source?.folderId ?? source?.noteFolderId ?? null;
    const folderName =
      source?.folderName ??
      folders.find((folder) => folder.id === defaultFolderId)?.name ??
      null;
    const existingCount = countQuizzesForFolder(
      allQuizzes,
      defaultFolderId,
      source?.sourceName,
    );
    setSaveDefaults({
      title: defaultQuizTitle({
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
    if (!user || !storedQuestionsRef.current) return;
    const finalScore = finished ? score : null;
    if (activeSavedId) {
      if (finalScore != null) {
        await updateQuizAttempt(user.uid, activeSavedId, finalScore);
      }
    } else {
      const row = await saveQuiz(user.uid, {
        title: payload.title,
        sourceName: source?.sourceName ?? 'Study source',
        sourceType: source?.sourceType ?? 'paste',
        folderId: payload.folderId,
        folderName: payload.folderName,
        noteFileId: source?.noteFileId ?? null,
        questions: storedQuestionsRef.current,
        scoreLastAttempt: finalScore,
      });
      setActiveSavedId(row.quizId);
    }
    setAllQuizzes(await listSavedQuizzes(user.uid));
  }

  async function handleFinishSave() {
    if (activeSavedId && user && finished) {
      await updateQuizAttempt(user.uid, activeSavedId, score);
      setAllQuizzes(await listSavedQuizzes(user.uid));
      return;
    }
    openSaveModal();
  }

  function reshuffleRetake() {
    if (!storedQuestionsRef.current) return;
    setAttemptQuestions(shuffleQuizForAttempt({ questions: storedQuestionsRef.current }));
    setIndex(0);
    setSelected(null);
    setScore(0);
    setFinished(false);
  }

  const current = quiz?.[index];

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Study tools</p>
        <h1 className="mt-1 text-3xl font-semibold text-text-primary">Quiz Generator</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Turn notes into multiple-choice questions with citations. Saved quizzes appear in your Notes
          folders.
        </p>
      </div>

      {!quiz ? (
        <>
          <StudySourcePicker
            source={source}
            onSourceReady={handleSourceReady}
            onUploadPendingChange={setUploadPending}
          />
          <div className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="text-sm font-semibold text-text-secondary">Questions</span>
              <select
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="sc-input mt-1"
              >
                {QUIZ_QUESTION_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={loading}
              onClick={() => void generateQuiz()}
              className="sc-btn-primary disabled:opacity-60"
            >
              {loading ? 'Generating…' : 'Generate quiz'}
            </button>
          </div>
        </>
      ) : (
        <div className="space-y-4 rounded-[16px] border border-border bg-surface p-5">
          {!finished && current ? (
            <>
              <p className="text-xs text-text-muted">
                Question {index + 1} of {quiz.length}
              </p>
              <h2 className="text-lg font-semibold text-text-primary">{current.question}</h2>
              <div className="space-y-2">
                {current.options.map((option) => (
                  <button
                    key={option}
                    type="button"
                    disabled={selected != null}
                    onClick={() => submitAnswer(option)}
                    className={[
                      'w-full rounded-[12px] border px-4 py-3 text-left text-sm',
                      selected === option
                        ? option.trim() === current.correctAnswer.trim()
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                          : 'border-rose-400 bg-rose-50 text-rose-900'
                        : 'border-border bg-surface-2 hover:bg-surface',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                ))}
              </div>
              {selected ? (
                <p className="text-sm text-text-secondary">
                  <span className="font-semibold">Citation:</span> {current.citation}
                </p>
              ) : null}
              {selected && index < quiz.length - 1 ? (
                <button type="button" onClick={nextQuestion} className="sc-btn-secondary">
                  Next question
                </button>
              ) : null}
            </>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xl font-semibold text-text-primary">Quiz complete</h2>
              <p className="text-sm text-text-secondary">
                Score: {score} / {quiz.length}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void handleFinishSave()} className="sc-btn-primary">
                  {activeSavedId ? 'Update score' : 'Save quiz'}
                </button>
                <button type="button" onClick={reshuffleRetake} className="sc-btn-secondary">
                  Retake (shuffle)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetAttemptState();
                    setError(null);
                  }}
                  className="sc-btn-secondary"
                >
                  New quiz
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      {source?.text && quiz ? (
        <div className="flex flex-wrap gap-3">
          <Link
            href="/app/flashcards"
            onClick={() => source && saveStudySourceToSession(source)}
            className="text-sm font-semibold text-accent"
          >
            Generate flashcards from this source →
          </Link>
          <Link href="/app/notes" className="text-sm font-semibold text-text-secondary">
            View saved quizzes in Notes →
          </Link>
        </div>
      ) : (
        <Link href="/app/notes" className="text-sm font-semibold text-text-secondary">
          Open Notes to study files or view saved quizzes →
        </Link>
      )}

      <SaveStudyItemModal
        open={saveOpen}
        kind="quiz"
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
