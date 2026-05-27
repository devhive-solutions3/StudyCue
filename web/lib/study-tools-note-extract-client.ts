'use client';

import type { NoteFile } from '@studycue/types';

import { extractTextFromNoteFile } from '@/lib/note-study-text';
import { isNoteFileLocalOnly } from '@/lib/note-study-text-shared';
import type { StudySourceSelection } from '@/lib/study-tools-types';
import { STUDY_SOURCE_MAX_CHARS } from '@/lib/study-tools-types';

export type NoteStudyExtractResponse = {
  text: string;
  sourceName: string;
  sourceType: 'notes';
  folderId: number;
  fileId: number;
  characterCount: number;
  extractionMethod: string;
  folderName?: string | null;
};

function formatStudyFetchError(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    if (/noteFileDocPath|client function from the server|use client/i.test(error.message)) {
      return 'Could not read this note file. Please try again.';
    }
    if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
      return 'Could not reach the study tools server. Check your connection and try again.';
    }
    return error.message;
  }
  return fallback;
}

async function authHeaders(getIdToken?: () => Promise<string | null>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const token = getIdToken ? await getIdToken() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // optional
  }
  return headers;
}

export async function fetchNoteStudyText(params: {
  folderId: number;
  fileId: number;
  folderName?: string | null;
  checkGenerationLimit?: boolean;
  getIdToken?: () => Promise<string | null>;
}): Promise<NoteStudyExtractResponse> {
  const res = await fetch('/api/study-tools/extract-note-text', {
    method: 'POST',
    headers: await authHeaders(params.getIdToken),
    credentials: 'same-origin',
    body: JSON.stringify({
      folderId: params.folderId,
      fileId: params.fileId,
      folderName: params.folderName ?? null,
      checkGenerationLimit: params.checkGenerationLimit === true,
    }),
  });

  let payload: Record<string, unknown> | null = null;
  try {
    payload = (await res.json()) as Record<string, unknown>;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload && typeof payload.error === 'string'
        ? payload.error
        : res.status === 429
          ? 'You have reached your daily Study Tools generation limit.'
          : 'Could not read text from this note file.';
    throw new Error(message);
  }

  const text = typeof payload?.text === 'string' ? payload.text : '';
  if (!text.trim()) {
    throw new Error('Could not read text from this note file.');
  }

  return {
    text,
    sourceName: typeof payload?.sourceName === 'string' ? payload.sourceName : 'Note file',
    sourceType: 'notes',
    folderId: Number(payload?.folderId ?? params.folderId),
    fileId: Number(payload?.fileId ?? params.fileId),
    characterCount: typeof payload?.characterCount === 'number' ? payload.characterCount : text.length,
    extractionMethod:
      typeof payload?.extractionMethod === 'string' ? payload.extractionMethod : 'unknown',
    folderName: typeof payload?.folderName === 'string' ? payload.folderName : params.folderName ?? null,
  };
}

export async function buildStudySourceFromNoteFile(
  file: NoteFile,
  folderName?: string | null,
  options?: {
    checkGenerationLimit?: boolean;
    getIdToken?: () => Promise<string | null>;
  },
): Promise<StudySourceSelection> {
  try {
    const extracted = isNoteFileLocalOnly(file)
      ? {
          text: await extractTextFromNoteFile(file),
          sourceName: file.name,
          folderId: file.folderId,
          fileId: file.id,
          characterCount: 0,
          extractionMethod: 'local',
          folderName: folderName ?? null,
        }
      : await fetchNoteStudyText({
          folderId: file.folderId,
          fileId: file.id,
          folderName,
          checkGenerationLimit: options?.checkGenerationLimit,
          getIdToken: options?.getIdToken,
        });

    if (extracted.text.length > STUDY_SOURCE_MAX_CHARS) {
      throw new Error(`Text must be under ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters.`);
    }

    return {
      sourceType: 'notes',
      sourceName: extracted.sourceName,
      text: extracted.text,
      noteFileId: file.id,
      folderId: file.folderId,
      noteFolderId: file.folderId,
      folderName: folderName ?? extracted.folderName ?? undefined,
      noteStoragePath: file.storagePath,
    };
  } catch (error) {
    throw new Error(formatStudyFetchError(error, 'Could not read text from this note file.'));
  }
}
