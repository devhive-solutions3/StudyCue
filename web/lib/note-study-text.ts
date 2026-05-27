'use client';

import type { NoteFile } from '@studycue/types';

import {
  getLocalNoteFile,
  isLocalNoteUrl,
  storagePathFromLocalNoteUrl,
} from '@/lib/local-file-store';
import {
  isExtractableStudyFile,
  studyFileTypeForMetadata,
} from '@/lib/study-file-extract';
import { extractTextFromStudyFile } from '@/lib/study-tools-text-extraction';

export function noteFileSupportsTextExtraction(file: NoteFile): boolean {
  const ext = (file.extension ?? file.name.split('.').pop() ?? '').toLowerCase();
  return isExtractableStudyFile(`file.${ext}`);
}

export function noteFileExtractionMessage(file: NoteFile): string | null {
  const ext = (file.extension ?? file.name.split('.').pop() ?? '').toLowerCase();
  if (ext === 'ppt') {
    return 'Legacy .ppt text extraction is not supported yet. Please convert to .pptx or paste the notes.';
  }
  if (ext === 'doc') {
    return 'Legacy .doc text extraction is not supported yet. Please convert to .docx or paste the notes.';
  }
  if (noteFileSupportsTextExtraction(file)) return null;
  return 'This file type cannot be used as study source yet. Try upload or paste text.';
}

async function fetchNoteBlob(file: NoteFile): Promise<Blob> {
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
  if (!url || url.startsWith('studycue-local-note://')) {
    throw new Error('This note file is not available to read on this device.');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Could not download the selected note file.');
  }
  return response.blob();
}

async function blobToStudyFile(blob: Blob, fileName: string): Promise<File> {
  return new File([blob], fileName, {
    type: blob.type || 'application/octet-stream',
  });
}

export async function extractTextFromNoteFile(file: NoteFile): Promise<string> {
  const warning = noteFileExtractionMessage(file);
  if (warning) {
    throw new Error(warning);
  }

  const blob = await fetchNoteBlob(file);
  const name = file.name || `note.${file.extension ?? 'bin'}`;
  const upload = await blobToStudyFile(blob, name);
  const result = await extractTextFromStudyFile(upload);
  return result.text;
}

/** @deprecated Use extractTextFromStudyFile — kept for callers that only need text. */
export async function readUploadFileAsText(file: File): Promise<string> {
  const result = await extractTextFromStudyFile(file);
  return result.text;
}

export function uploadFileTypeLabel(fileName: string): string {
  return studyFileTypeForMetadata(fileName);
}
