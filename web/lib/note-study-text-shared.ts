import type { NoteFile } from '@studycue/types';

import { isLocalNoteUrl } from '@/lib/local-file-store';
import {
  isExtractableStudyFile,
  studyFileTypeForMetadata,
} from '@/lib/study-file-extract';

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

export function isNoteFileLocalOnly(file: NoteFile): boolean {
  const provider = String(file.storageProvider ?? '')
    .trim()
    .toLowerCase();
  if (provider === 'local' || provider === 'local-only') return true;
  if (isLocalNoteUrl(file.downloadURL ?? file.downloadUrl)) return true;
  return !file.storagePath?.trim();
}

export function noteFileExtractionMethodLabel(fileName: string): string {
  return studyFileTypeForMetadata(fileName);
}
