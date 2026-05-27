'use client';

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';

import { getFirebaseDb } from '@/lib/firebase-client';
import { quizFolderId } from '@/lib/study-tools-save-titles';
import {
  expandDeckForUi,
  expandQuizForUi,
  flashcardDeckDocumentForFirestore,
  quizDocumentForFirestore,
} from '@/lib/study-tools-storage';
import type { FlashcardItem, QuizQuestion, SavedFlashcardDeck, SavedQuiz, StudySourceType } from '@/lib/study-tools-types';

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseSavedQuiz(data: Record<string, unknown>): SavedQuiz {
  return expandQuizForUi(data as SavedQuiz & { questions?: unknown });
}

function parseSavedDeck(data: Record<string, unknown>): SavedFlashcardDeck {
  return expandDeckForUi(data as SavedFlashcardDeck & { cards?: unknown });
}

export async function listSavedQuizzes(uid: string): Promise<SavedQuiz[]> {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'quizzes'), orderBy('updatedAt', 'desc')),
  );
  return snapshot.docs.map((docSnap) => parseSavedQuiz(docSnap.data() as Record<string, unknown>));
}

export async function getSavedQuiz(uid: string, quizId: string): Promise<SavedQuiz | null> {
  const snapshot = await getDoc(doc(getFirebaseDb(), 'users', uid, 'quizzes', quizId));
  return snapshot.exists() ? parseSavedQuiz(snapshot.data() as Record<string, unknown>) : null;
}

export function filterQuizzesByFolder(quizzes: SavedQuiz[], folderId: number): SavedQuiz[] {
  return quizzes.filter((row) => quizFolderId(row) === folderId);
}

export async function saveQuiz(
  uid: string,
  params: {
    title: string;
    sourceName: string;
    sourceType: StudySourceType;
    folderId?: number | null;
    folderName?: string | null;
    noteFileId?: number | null;
    questions: QuizQuestion[];
    scoreLastAttempt?: number | null;
  },
): Promise<SavedQuiz> {
  const now = new Date().toISOString();
  const quizId = newId('quiz');
  const folderId = params.folderId ?? null;
  const firestoreDoc = quizDocumentForFirestore({
    quizId,
    uid,
    title: params.title.trim() || 'Quiz',
    sourceName: params.sourceName,
    sourceType: params.sourceType,
    folderId,
    folderName: params.folderName ?? null,
    noteFileId: params.noteFileId ?? null,
    noteFolderId: folderId,
    questions: params.questions,
    scoreLastAttempt: params.scoreLastAttempt ?? null,
    attemptsCount: params.scoreLastAttempt != null ? 1 : 0,
    createdAt: now,
    updatedAt: now,
    lastTakenAt: params.scoreLastAttempt != null ? now : null,
  });
  await setDoc(doc(getFirebaseDb(), 'users', uid, 'quizzes', quizId), firestoreDoc);
  return parseSavedQuiz(firestoreDoc as unknown as Record<string, unknown>);
}

export async function updateQuizAttempt(uid: string, quizId: string, score: number) {
  const ref = doc(getFirebaseDb(), 'users', uid, 'quizzes', quizId);
  const snapshot = await getDoc(ref);
  const previousAttempts =
    snapshot.exists() && typeof snapshot.data()?.attemptsCount === 'number'
      ? snapshot.data()!.attemptsCount
      : 0;
  const now = new Date().toISOString();
  await setDoc(
    ref,
    {
      scoreLastAttempt: score,
      attemptsCount: previousAttempts + 1,
      updatedAt: now,
      lastTakenAt: now,
    },
    { merge: true },
  );
}

export async function deleteSavedQuiz(uid: string, quizId: string) {
  await deleteDoc(doc(getFirebaseDb(), 'users', uid, 'quizzes', quizId));
}

export async function listFlashcardDecks(uid: string): Promise<SavedFlashcardDeck[]> {
  const db = getFirebaseDb();
  const snapshot = await getDocs(
    query(collection(db, 'users', uid, 'flashcardDecks'), orderBy('updatedAt', 'desc')),
  );
  return snapshot.docs.map((docSnap) => parseSavedDeck(docSnap.data() as Record<string, unknown>));
}

export function filterDecksByFolder(decks: SavedFlashcardDeck[], folderId: number): SavedFlashcardDeck[] {
  return decks.filter((row) => (row.folderId ?? row.noteFolderId) === folderId);
}

export async function saveFlashcardDeck(
  uid: string,
  params: {
    title: string;
    sourceName: string;
    sourceType: StudySourceType;
    folderId?: number | null;
    folderName?: string | null;
    noteFileId?: number | null;
    cards: FlashcardItem[];
  },
): Promise<SavedFlashcardDeck> {
  const now = new Date().toISOString();
  const deckId = newId('deck');
  const folderId = params.folderId ?? null;
  const firestoreDoc = flashcardDeckDocumentForFirestore({
    deckId,
    uid,
    title: params.title.trim() || 'Flashcard deck',
    sourceName: params.sourceName,
    sourceType: params.sourceType,
    folderId,
    folderName: params.folderName ?? null,
    noteFileId: params.noteFileId ?? null,
    noteFolderId: folderId,
    cards: params.cards,
    knownCount: 0,
    reviewCount: params.cards.length,
    createdAt: now,
    updatedAt: now,
    lastReviewedAt: null,
  });
  await setDoc(doc(getFirebaseDb(), 'users', uid, 'flashcardDecks', deckId), firestoreDoc);
  return parseSavedDeck(firestoreDoc as unknown as Record<string, unknown>);
}

export async function updateFlashcardDeckProgress(
  uid: string,
  deckId: string,
  knownCount: number,
  reviewCount: number,
) {
  const now = new Date().toISOString();
  await setDoc(
    doc(getFirebaseDb(), 'users', uid, 'flashcardDecks', deckId),
    { knownCount, reviewCount, updatedAt: now, lastReviewedAt: now },
    { merge: true },
  );
}

export async function deleteFlashcardDeck(uid: string, deckId: string) {
  await deleteDoc(doc(getFirebaseDb(), 'users', uid, 'flashcardDecks', deckId));
}
