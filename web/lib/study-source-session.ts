'use client';

import type { StudySourceSelection } from '@/lib/study-tools-types';

const SESSION_KEY = 'studycue_study_source_v1';
const MAX_AGE_MS = 60 * 60 * 1000;

type StoredStudySource = StudySourceSelection & { savedAt: number };

export function saveStudySourceToSession(selection: StudySourceSelection) {
  if (typeof window === 'undefined') return;
  const payload: StoredStudySource = { ...selection, savedAt: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function readStudySourceFromSession(): StudySourceSelection | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredStudySource;
    if (!parsed?.text?.trim() || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return {
      sourceType: parsed.sourceType,
      sourceName: parsed.sourceName,
      text: parsed.text,
      noteFileId: parsed.noteFileId,
      noteFolderId: parsed.noteFolderId,
      folderId: parsed.folderId ?? parsed.noteFolderId,
      folderName: parsed.folderName,
      noteStoragePath: parsed.noteStoragePath,
    };
  } catch {
    return null;
  }
}

export function clearStudySourceSession() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(SESSION_KEY);
}
