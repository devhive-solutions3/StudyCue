import 'server-only';

/**
 * Temporary Cue-generated quiz/flashcard payloads (24h).
 * Firestore path: users/{uid}/cueStudySessions/{sessionId}
 * Recommended: enable Firestore TTL on field `expiresAt` in Firebase Console.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { isoNow } from '@/lib/admin-log';
import {
  CUE_STUDY_SESSION_TTL_MS,
  type CueStudySessionSourceType,
  type CueStudySessionSummary,
  type CueStudySessionType,
} from '@/lib/cue-study-session-types';
import { getFirebaseAdminDb, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import {
  compactFlashcardsForStorage,
  compactQuizForStorage,
  expandQuizQuestionsFromStorage,
  normalizeGeneratedFlashcards,
} from '@/lib/study-tools-storage';
import type { FlashcardItem, QuizQuestion } from '@/lib/study-tools-types';

type SessionRecord = {
  sessionId: string;
  uid: string;
  type: CueStudySessionType;
  sourceName: string;
  sourceType: CueStudySessionSourceType;
  sourceSurface: 'cue_ai';
  title: string;
  payload: unknown;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  openedAt?: string | null;
  savedAt?: string | null;
  savedTargetId?: string | null;
  requestedFolderName?: string | null;
};

function isExpired(expiresAt: string, now = isoNow()) {
  return expiresAt <= now;
}

function parseSummary(id: string, data: Record<string, unknown>): CueStudySessionSummary | null {
  const type = data.type;
  if (type !== 'quiz' && type !== 'flashcards' && type !== 'file_study') return null;
  return {
    sessionId: id,
    type,
    sourceName: typeof data.sourceName === 'string' ? data.sourceName : 'Study source',
    sourceType:
      data.sourceType === 'cue_attachment' ||
      data.sourceType === 'paste' ||
      data.sourceType === 'notes' ||
      data.sourceType === 'upload'
        ? data.sourceType
        : 'cue_attachment',
    title: typeof data.title === 'string' ? data.title : 'Study session',
    itemCount: typeof data.itemCount === 'number' ? data.itemCount : 0,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : isoNow(),
    expiresAt: typeof data.expiresAt === 'string' ? data.expiresAt : isoNow(),
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : null,
    savedTargetId: typeof data.savedTargetId === 'string' ? data.savedTargetId : null,
    requestedFolderName:
      typeof data.requestedFolderName === 'string' ? data.requestedFolderName : null,
  };
}

export async function createCueStudySession(params: {
  uid: string;
  type: 'quiz' | 'flashcards';
  sourceName: string;
  sourceType: CueStudySessionSourceType;
  questions?: QuizQuestion[];
  cards?: FlashcardItem[];
  requestedFolderName?: string | null;
}): Promise<{ sessionId: string; expiresAt: string } | null> {
  if (!readFirebaseAdminStatus().configured) return null;

  const createdAt = isoNow();
  const expiresAt = new Date(Date.parse(createdAt) + CUE_STUDY_SESSION_TTL_MS).toISOString();
  const db = getFirebaseAdminDb();
  const ref = db.collection(`users/${params.uid}/cueStudySessions`).doc();

  const payload =
    params.type === 'quiz'
      ? compactQuizForStorage(params.questions ?? [])
      : compactFlashcardsForStorage(params.cards ?? []);

  const itemCount =
    params.type === 'quiz' ? (params.questions?.length ?? 0) : (params.cards?.length ?? 0);

  const title =
    params.type === 'quiz'
      ? `Quiz from ${params.sourceName}`
      : `Flashcards from ${params.sourceName}`;

  await ref.set({
    sessionId: ref.id,
    uid: params.uid,
    type: params.type,
    sourceName: params.sourceName,
    sourceType: params.sourceType,
    sourceSurface: 'cue_ai',
    title,
    payload,
    itemCount,
    requestedFolderName: params.requestedFolderName ?? null,
    createdAt,
    updatedAt: createdAt,
    expiresAt,
    openedAt: null,
    savedAt: null,
    savedTargetId: null,
    serverTimestamp: FieldValue.serverTimestamp(),
  });

  return { sessionId: ref.id, expiresAt };
}

export async function deleteCueStudySession(uid: string, sessionId: string) {
  if (!readFirebaseAdminStatus().configured) return;
  await getFirebaseAdminDb().doc(`users/${uid}/cueStudySessions/${sessionId}`).delete().catch(() => {});
}

export async function getCueStudySessionForUser(
  uid: string,
  sessionId: string,
): Promise<
  | { ok: true; session: SessionRecord & { questions?: QuizQuestion[]; cards?: FlashcardItem[] } }
  | { ok: false; reason: 'not_found' | 'expired' | 'wrong_type' }
> {
  if (!readFirebaseAdminStatus().configured) {
    return { ok: false, reason: 'not_found' };
  }

  const ref = getFirebaseAdminDb().doc(`users/${uid}/cueStudySessions/${sessionId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) return { ok: false, reason: 'not_found' };

  const data = (snapshot.data() ?? {}) as Record<string, unknown>;
  if (data.uid !== uid) return { ok: false, reason: 'not_found' };

  const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : '';
  if (!expiresAt || isExpired(expiresAt)) {
    await ref.delete().catch(() => {});
    return { ok: false, reason: 'expired' };
  }

  const summary = parseSummary(snapshot.id, data);
  if (!summary) return { ok: false, reason: 'not_found' };

  const base: SessionRecord = {
    sessionId: snapshot.id,
    uid,
    type: summary.type,
    sourceName: summary.sourceName,
    sourceType: summary.sourceType,
    sourceSurface: 'cue_ai',
    title: summary.title,
    payload: data.payload,
    itemCount: summary.itemCount,
    createdAt: summary.createdAt,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : summary.createdAt,
    expiresAt: summary.expiresAt,
    openedAt: typeof data.openedAt === 'string' ? data.openedAt : null,
    savedAt: summary.savedAt,
    savedTargetId: summary.savedTargetId,
    requestedFolderName: summary.requestedFolderName,
  };

  if (summary.type === 'quiz') {
    const questions = expandQuizQuestionsFromStorage(data.payload);
    if (!questions.length) return { ok: false, reason: 'not_found' };
    return { ok: true, session: { ...base, type: 'quiz', questions } };
  }

  if (summary.type === 'flashcards') {
    const cards = normalizeGeneratedFlashcards(data.payload);
    if (!cards.length) return { ok: false, reason: 'not_found' };
    return { ok: true, session: { ...base, type: 'flashcards', cards } };
  }

  return { ok: false, reason: 'wrong_type' };
}

export async function listCueStudySessionsForUser(uid: string): Promise<CueStudySessionSummary[]> {
  if (!readFirebaseAdminStatus().configured) return [];

  const db = getFirebaseAdminDb();
  const now = isoNow();
  const snapshot = await db
    .collection(`users/${uid}/cueStudySessions`)
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get()
    .catch(async () => db.collection(`users/${uid}/cueStudySessions`).limit(30).get());

  const active: CueStudySessionSummary[] = [];
  const expiredIds: string[] = [];

  for (const doc of snapshot.docs) {
    const data = (doc.data() ?? {}) as Record<string, unknown>;
    const expiresAt = typeof data.expiresAt === 'string' ? data.expiresAt : '';
    if (!expiresAt || isExpired(expiresAt, now)) {
      expiredIds.push(doc.id);
      continue;
    }
    const summary = parseSummary(doc.id, data);
    if (summary && (summary.type === 'quiz' || summary.type === 'flashcards')) {
      active.push(summary);
    }
  }

  if (expiredIds.length > 0) {
    await Promise.all(
      expiredIds.map((id) => db.doc(`users/${uid}/cueStudySessions/${id}`).delete().catch(() => {})),
    );
  }

  return active;
}

export async function markCueStudySessionOpened(uid: string, sessionId: string) {
  if (!readFirebaseAdminStatus().configured) return;
  const now = isoNow();
  await getFirebaseAdminDb()
    .doc(`users/${uid}/cueStudySessions/${sessionId}`)
    .set({ openedAt: now, updatedAt: now }, { merge: true });
}

export async function markCueStudySessionSaved(
  uid: string,
  sessionId: string,
  savedTargetId: string,
) {
  if (!readFirebaseAdminStatus().configured) return;
  const now = isoNow();
  await getFirebaseAdminDb()
    .doc(`users/${uid}/cueStudySessions/${sessionId}`)
    .set(
      {
        savedAt: now,
        savedTargetId,
        updatedAt: now,
        serverTimestamp: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}
