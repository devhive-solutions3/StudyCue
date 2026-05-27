import 'server-only';

import { gunzipSync } from 'node:zlib';

import type { NoteFile } from '@studycue/types';

import { extractStudyFileText } from '@/lib/study-file-extract-server';
import { getFirebaseAdminDb, getFirebaseAdminStorage, readFirebaseAdminStatus } from '@/lib/firebase-admin';
import { noteFileDocPath } from '@/lib/notes-paths';
import {
  noteFileExtractionMessage,
  noteFileSupportsTextExtraction,
} from '@/lib/note-study-text-shared';
import { STUDY_SOURCE_MAX_CHARS } from '@/lib/study-tools-types';

const IS_DEV = process.env.NODE_ENV !== 'production';

export type NoteFileStudyExtractResult = {
  text: string;
  sourceName: string;
  sourceType: 'notes';
  folderId: number;
  fileId: number;
  characterCount: number;
  extractionMethod: string;
  folderName?: string | null;
};

function parseNoteFileRecord(
  folderId: number,
  docId: string,
  data: Record<string, unknown>,
): NoteFile {
  return {
    id: Number(data.id ?? docId),
    folderId,
    name: String(data.name ?? data.originalName ?? data.safeFileName ?? `File ${docId}`),
    originalName: typeof data.originalName === 'string' ? data.originalName : null,
    safeFileName: typeof data.safeFileName === 'string' ? data.safeFileName : null,
    extension: typeof data.extension === 'string' ? data.extension : null,
    sizeBytes: Number(data.sizeBytes ?? data.size ?? 0),
    originalSizeBytes: Number(data.originalSizeBytes ?? data.sizeBytes ?? data.size ?? 0),
    storedSizeBytes: Number(data.storedSizeBytes ?? data.sizeBytes ?? data.size ?? 0),
    compressionSavedBytes: Number(data.compressionSavedBytes ?? 0),
    compressionRatio: Number(data.compressionRatio ?? 1),
    compressionMethod: typeof data.compressionMethod === 'string' ? data.compressionMethod : null,
    compressionWarning: typeof data.compressionWarning === 'string' ? data.compressionWarning : null,
    storagePath: typeof data.storagePath === 'string' ? data.storagePath : '',
    downloadUrl: String(data.downloadUrl ?? data.downloadURL ?? ''),
    downloadURL: typeof data.downloadURL === 'string' ? data.downloadURL : null,
    compressed: Number(data.compressed ?? 0),
    mimeType: typeof data.mimeType === 'string' ? data.mimeType : null,
    contentType: typeof data.contentType === 'string' ? data.contentType : null,
    createdAt: typeof data.createdAt === 'string' ? data.createdAt : null,
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : null,
    storageProvider:
      data.storageProvider === 'firebase' || data.storageProvider === 'local'
        ? data.storageProvider
        : null,
  };
}

async function readNoteFileMetadata(uid: string, folderId: number, fileId: number) {
  if (!readFirebaseAdminStatus().configured) {
    throw new Error('Server storage access is not configured for Notes text extraction.');
  }

  const snap = await getFirebaseAdminDb()
    .doc(noteFileDocPath(uid, folderId, fileId))
    .get();

  if (!snap.exists) {
    throw new Error('Could not find this note file.');
  }

  const data = (snap.data() ?? {}) as Record<string, unknown>;
  if (Number(data.folderId) !== folderId && data.folderId != null) {
    throw new Error('You do not have permission to read this file.');
  }

  return parseNoteFileRecord(folderId, snap.id, data);
}

function decompressStoredBuffer(buffer: Buffer, file: NoteFile): Buffer {
  const usesGzip =
    file.compressed === 1 &&
    (file.compressionMethod === 'gzip' || file.contentType === 'application/gzip');
  if (!usesGzip) return buffer;
  try {
    return gunzipSync(buffer);
  } catch {
    throw new Error('Could not decompress this note file for reading.');
  }
}

async function downloadNoteFileBuffer(uid: string, file: NoteFile): Promise<Buffer> {
  const storagePath = file.storagePath?.trim();
  if (!storagePath) {
    throw new Error('This note file has no storage path.');
  }

  if (!storagePath.startsWith(`users/${uid}/`)) {
    throw new Error('You do not have permission to read this file.');
  }

  if (!readFirebaseAdminStatus().configured) {
    throw new Error('Server storage access is not configured for Notes text extraction.');
  }

  const bucket = getFirebaseAdminStorage().bucket();
  const [buffer] = await bucket.file(storagePath).download().catch((error: unknown) => {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: number }).code)
        : '';
    if (code === '404' || code === '5') {
      throw new Error('Could not download the selected note file from storage.');
    }
    throw new Error('Could not download the selected note file from storage.');
  });

  return decompressStoredBuffer(buffer, file);
}

export async function extractTextFromExistingNoteFile(params: {
  uid: string;
  folderId: number;
  fileId: number;
  folderName?: string | null;
}): Promise<NoteFileStudyExtractResult> {
  const file = await readNoteFileMetadata(params.uid, params.folderId, params.fileId);

  if (IS_DEV) {
    console.info('[note-study-extract]', {
      uidExists: Boolean(params.uid),
      folderId: params.folderId,
      fileId: params.fileId,
      storagePathExists: Boolean(file.storagePath?.trim()),
      mimeType: file.mimeType ?? file.contentType ?? null,
      sizeBytes: file.sizeBytes,
      extension: file.extension,
      storageProvider: file.storageProvider,
    });
  }

  const unsupported = noteFileExtractionMessage(file);
  if (unsupported) {
    throw new Error(unsupported);
  }

  if (!noteFileSupportsTextExtraction(file)) {
    throw new Error('This file type is not supported yet.');
  }

  const buffer = await downloadNoteFileBuffer(params.uid, file);
  const fileName = file.name || `note.${file.extension ?? 'bin'}`;
  const { text, fileType } = await extractStudyFileText({ buffer, fileName });

  if (text.length > STUDY_SOURCE_MAX_CHARS) {
    throw new Error(
      `Extracted text must be under ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters. Try a shorter document.`,
    );
  }

  return {
    text,
    sourceName: file.name,
    sourceType: 'notes',
    folderId: params.folderId,
    fileId: params.fileId,
    characterCount: text.length,
    extractionMethod: fileType,
    folderName: params.folderName ?? null,
  };
}
