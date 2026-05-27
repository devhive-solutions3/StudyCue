'use client';

import type { NoteFile } from '@studycue/types';

import { extractTextFromNoteFile } from '@/lib/note-study-text';
import type { StudySourceSelection } from '@/lib/study-tools-types';
import { STUDY_SOURCE_MAX_CHARS } from '@/lib/study-tools-types';

export async function buildStudySourceFromNoteFile(
  file: NoteFile,
  folderName?: string | null,
): Promise<StudySourceSelection> {
  const text = await extractTextFromNoteFile(file);
  if (text.length > STUDY_SOURCE_MAX_CHARS) {
    throw new Error(`Text must be under ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters.`);
  }
  return {
    sourceType: 'notes',
    sourceName: file.name,
    text,
    noteFileId: file.id,
    folderId: file.folderId,
    noteFolderId: file.folderId,
    folderName: folderName ?? undefined,
    noteStoragePath: file.storagePath,
  };
}
