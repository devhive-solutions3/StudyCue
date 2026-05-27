'use client';

import type { NoteFile } from '@studycue/types';

import {
  getLocalNoteFile,
  isLocalNoteUrl,
  storagePathFromLocalNoteUrl,
} from '@/lib/local-file-store';
import { extractTextFromStudyFile } from '@/lib/study-tools-text-extraction';
import { noteFileExtractionMessage } from '@/lib/note-study-text-shared';

export {
  noteFileExtractionMessage,
  noteFileSupportsTextExtraction,
  isNoteFileLocalOnly,
} from '@/lib/note-study-text-shared';

async function fetchLocalNoteBlob(file: NoteFile): Promise<Blob> {
  const url = file.downloadURL ?? file.downloadUrl;
  if (url && isLocalNoteUrl(url)) {
    const path = file.storagePath || storagePathFromLocalNoteUrl(url);
    const local = await getLocalNoteFile(path);
    if (!local) {
      throw new Error('This note file is not available to read on this device.');
    }
    return local.blob;
  }
  if (file.storagePath && file.storageProvider === 'local') {
    const local = await getLocalNoteFile(file.storagePath);
    if (!local) {
      throw new Error('This note file is not available to read on this device.');
    }
    return local.blob;
  }
  throw new Error('This note file is not available to read on this device.');
}

async function blobToStudyFile(blob: Blob, fileName: string): Promise<File> {
  return new File([blob], fileName, {
    type: blob.type || 'application/octet-stream',
  });
}

/** Client-only extraction for locally stored note files (IndexedDB). */
export async function extractTextFromNoteFile(file: NoteFile): Promise<string> {
  const warning = noteFileExtractionMessage(file);
  if (warning) {
    throw new Error(warning);
  }

  const blob = await fetchLocalNoteBlob(file);
  const name = file.name || `note.${file.extension ?? 'bin'}`;
  const upload = await blobToStudyFile(blob, name);
  const result = await extractTextFromStudyFile(upload);
  return result.text;
}
