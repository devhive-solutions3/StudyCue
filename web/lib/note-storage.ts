'use client';

import type { NoteFile, NoteFolder } from '@studycue/types';
import { deleteObject, ref } from 'firebase/storage';

import { getFirebaseDb, getFirebaseStorage } from '@/lib/firebase-client';
import {
  deleteLocalNoteFile,
  isLocalNoteUrl,
  storagePathFromLocalNoteUrl,
} from '@/lib/local-file-store';

const IS_DEV = process.env.NODE_ENV !== 'production';

function normalizeSafeName(name: string) {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  const base = dot > 0 ? trimmed.slice(0, dot) : trimmed;
  const ext = dot > 0 ? trimmed.slice(dot + 1) : '';
  const safeBase = base
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return safeExt ? `${safeBase || 'note-file'}.${safeExt}` : safeBase || 'note-file';
}

export function buildNoteStorageFileName(originalName: string) {
  return `${Date.now()}-${normalizeSafeName(originalName)}`;
}

export function buildNoteStoragePath(uid: string, folderId: number, safeFileName: string) {
  return `users/${uid}/notes/${folderId}/${safeFileName}`;
}

export function noteFolderDocPath(uid: string, folderId: number) {
  return `users/${uid}/noteFolders/${folderId}`;
}

export function noteFileDocPath(uid: string, folderId: number, fileId: number) {
  return `${noteFolderDocPath(uid, folderId)}/files/${fileId}`;
}

export async function saveNoteFolderMetadata(uid: string, folder: NoteFolder) {
  const { doc, setDoc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  await setDoc(
    doc(db, 'users', uid, 'noteFolders', String(folder.id)),
    {
      id: folder.id,
      name: folder.name,
      slug: folder.slug,
      createdAt: folder.createdAt,
      updatedAt: folder.updatedAt ?? folder.createdAt,
    },
    { merge: true },
  );
}

export async function saveNoteFileMetadata(uid: string, file: NoteFile) {
  const { doc, setDoc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  await setDoc(
    doc(db, 'users', uid, 'noteFolders', String(file.folderId), 'files', String(file.id)),
    {
      id: file.id,
      folderId: file.folderId,
      originalName: file.originalName ?? file.name,
      safeFileName: file.safeFileName ?? file.name,
      originalSizeBytes: file.originalSizeBytes ?? file.sizeBytes,
      storedSizeBytes: file.storedSizeBytes ?? file.sizeBytes,
      compressionSavedBytes: file.compressionSavedBytes ?? 0,
      compressionRatio: file.compressionRatio ?? 1,
      compressionMethod: file.compressionMethod ?? null,
      compressionWarning: file.compressionWarning ?? null,
      storagePath: file.storagePath,
      downloadURL: file.downloadURL ?? file.downloadUrl,
      contentType: file.contentType ?? file.mimeType,
      size: file.sizeBytes,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt ?? file.createdAt,
      extension: file.extension,
      compressed: file.compressed ?? 0,
      storageProvider: file.storageProvider ?? null,
    },
    { merge: true },
  );
}

export async function deleteNoteFileMetadata(uid: string, folderId: number, fileId: number) {
  const { deleteDoc, doc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'users', uid, 'noteFolders', String(folderId), 'files', String(fileId)));
}

export async function deleteNoteFolderMetadata(uid: string, folderId: number) {
  const { deleteDoc, doc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  await deleteDoc(doc(db, 'users', uid, 'noteFolders', String(folderId)));
}

export async function reserveUserStorageBytes(
  uid: string,
  deltaBytes: number,
  fallbackLimitBytes: number,
) {
  if (!uid.trim() || !Number.isFinite(deltaBytes) || deltaBytes <= 0) return 0;

  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const db = getFirebaseDb();
  const ref = doc(db, 'users', uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = (snapshot.data() ?? {}) as Record<string, unknown>;
    const current =
      typeof data.storageUsedBytes === 'number' && Number.isFinite(data.storageUsedBytes)
        ? data.storageUsedBytes
        : 0;
    const limit =
      typeof data.storageLimitBytes === 'number' && Number.isFinite(data.storageLimitBytes)
        ? data.storageLimitBytes
        : fallbackLimitBytes;

    if (current + deltaBytes > limit) {
      throw new Error('storage_limit_exceeded');
    }

    const next = current + deltaBytes;
    transaction.set(
      ref,
      {
        storageUsedBytes: next,
        updatedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      },
      { merge: true },
    );

    return next;
  });
}

export async function adjustUserStorageUsedBytes(uid: string, deltaBytes: number) {
  if (!uid.trim() || !Number.isFinite(deltaBytes) || deltaBytes === 0) return 0;

  const { doc, runTransaction, serverTimestamp } = await import('firebase/firestore');
  const db = getFirebaseDb();
  const ref = doc(db, 'users', uid);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = (snapshot.data() ?? {}) as Record<string, unknown>;
    const current =
      typeof data.storageUsedBytes === 'number' && Number.isFinite(data.storageUsedBytes)
        ? data.storageUsedBytes
        : 0;
    const next = Math.max(0, current + deltaBytes);

    transaction.set(
      ref,
      {
        storageUsedBytes: next,
        updatedAt: new Date().toISOString(),
        serverTimestamp: serverTimestamp(),
      },
      { merge: true },
    );

    return next;
  });
}

export async function noteFolderMetadataExists(uid: string, folderId: number) {
  const { doc, getDoc } = await import('firebase/firestore');
  const db = getFirebaseDb();
  const snap = await getDoc(doc(db, 'users', uid, 'noteFolders', String(folderId)));
  return snap.exists();
}

export async function listNoteFileMetadata(uid: string, folderId: number) {
  const { collection, getDocs } = await import('firebase/firestore');
  const db = getFirebaseDb();
  const snap = await getDocs(
    collection(db, 'users', uid, 'noteFolders', String(folderId), 'files'),
  );

  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as Partial<NoteFile> & {
      storagePath?: string;
      downloadURL?: string;
      originalName?: string;
      originalSizeBytes?: number;
      storedSizeBytes?: number;
      compressionSavedBytes?: number;
      compressionRatio?: number;
      compressionMethod?: string;
      compressionWarning?: string;
      size?: number;
      contentType?: string;
    };

    return {
      id: Number(data.id ?? docSnap.id),
      folderId,
      name: data.name ?? data.originalName ?? data.safeFileName ?? `File ${docSnap.id}`,
      originalName: data.originalName ?? data.name ?? null,
      safeFileName: data.safeFileName ?? null,
      extension: data.extension ?? null,
      sizeBytes: Number(data.sizeBytes ?? data.size ?? 0),
      originalSizeBytes: Number(data.originalSizeBytes ?? data.sizeBytes ?? data.size ?? 0),
      storedSizeBytes: Number(data.storedSizeBytes ?? data.sizeBytes ?? data.size ?? 0),
      compressionSavedBytes: Number(data.compressionSavedBytes ?? 0),
      compressionRatio: Number(data.compressionRatio ?? 1),
      compressionMethod: data.compressionMethod ?? null,
      compressionWarning: data.compressionWarning ?? null,
      storagePath: data.storagePath ?? '',
      downloadUrl: data.downloadUrl ?? data.downloadURL ?? '',
      downloadURL: data.downloadURL ?? data.downloadUrl ?? null,
      compressed: data.compressed ?? 0,
      mimeType: data.mimeType ?? null,
      contentType: data.contentType ?? null,
      createdAt: data.createdAt ?? null,
      updatedAt: data.updatedAt ?? null,
      storageProvider: data.storageProvider ?? null,
    } satisfies NoteFile;
  });
}

function storageDeleteCode(error: unknown) {
  return error && typeof error === 'object' && 'code' in error
    ? String((error as { code?: string }).code)
    : '';
}

export type NoteAssetDeleteResult =
  | {
      status: 'local-deleted';
      localMirrorKey: string;
    }
  | {
      status: 'deleted' | 'object-not-found' | 'no-storage-path';
      localMirrorKey: string | null;
      storagePath: string | null;
    };

function resolveFileDownloadUrl(file: NoteFile) {
  return file.downloadUrl || file.downloadURL || '';
}

export async function deleteStoredNoteAsset(file: NoteFile) {
  const resolvedDownloadUrl = resolveFileDownloadUrl(file);

  if (resolvedDownloadUrl && isLocalNoteUrl(resolvedDownloadUrl)) {
    const localMirrorKey = storagePathFromLocalNoteUrl(resolvedDownloadUrl);
    await deleteLocalNoteFile(localMirrorKey);
    return { status: 'local-deleted' as const, localMirrorKey };
  }

  if (!file.storagePath?.trim()) {
    return { status: 'no-storage-path' as const, localMirrorKey: null, storagePath: null };
  }

  try {
    await deleteLocalNoteFile(file.storagePath).catch(() => {});
    const storage = getFirebaseStorage();
    await deleteObject(ref(storage, file.storagePath));
    return {
      status: 'deleted' as const,
      localMirrorKey: file.storagePath,
      storagePath: file.storagePath,
    };
  } catch (error) {
    const code = storageDeleteCode(error);
    if (code === 'storage/object-not-found') {
      if (IS_DEV) {
        console.info('[notes] storage object missing during delete', {
          fileId: file.id,
          storagePath: file.storagePath,
        });
      }
      return {
        status: 'object-not-found' as const,
        localMirrorKey: file.storagePath,
        storagePath: file.storagePath,
      };
    }
    throw error;
  }
}
