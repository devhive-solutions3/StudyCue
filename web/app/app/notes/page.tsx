'use client';

import { useEffect, useMemo, useState } from 'react';

import type { NoteFile, NoteFolder } from '@studycue/types';

import { useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';
import {
  getLocalNoteFile,
  isLocalNoteUrl,
  storagePathFromLocalNoteUrl,
} from '@/lib/local-file-store';
import { nextNumericId } from '@/lib/mirror-bootstrap';
import {
  buildNoteStorageFileName,
  buildNoteStoragePath,
  deleteNoteFileMetadata,
  deleteNoteFolderMetadata,
  deleteStoredNoteAsset,
  listNoteFileMetadata,
  noteFolderMetadataExists,
  noteFileDocPath,
  noteFolderDocPath,
  saveNoteFileMetadata,
  saveNoteFolderMetadata,
} from '@/lib/note-storage';
import {
  getUploadTasks,
  startNoteUpload,
  subscribeUploads,
  type NoteUploadTask,
} from '@/lib/note-upload-store';
import { publicFileStorageMode } from '@/lib/public-env';
import {
  notesRejectReasonAfterCompress,
  notesRejectReasonBeforeCompress,
  NOTES_LIMIT_HINT,
} from '@/lib/upload-limits';

const SUPPORTED_MIME = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);
const SUPPORTED_EXTENSIONS = new Set(['pdf', 'ppt', 'pptx']);

function cleanName(name: string) {
  return name.trim().replace(/\s+/g, ' ');
}

function slugify(name: string) {
  return cleanName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extFromName(name: string) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function isLocalOnlyFile(file: NoteFile) {
  const provider = String(file.storageProvider ?? '')
    .trim()
    .toLowerCase();
  if (provider === 'local' || provider === 'local-only') return true;
  if (isLocalNoteUrl(file.downloadUrl)) return true;
  return !file.storagePath?.trim();
}

function isFirebaseBackedFile(file: NoteFile) {
  const provider = String(file.storageProvider ?? '')
    .trim()
    .toLowerCase();
  if (provider === 'firebase') return true;
  return Boolean(file.storagePath?.trim()) && !isLocalNoteUrl(file.downloadUrl);
}

function triggerFileDownload(url: string, fileName: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  anchor.target = '_blank';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

async function gzipBlobIfPossible(file: File): Promise<{ blob: Blob; compressed: boolean }> {
  const CompressionCtor = (
    window as unknown as { CompressionStream?: new (format: string) => CompressionStream }
  ).CompressionStream;
  if (!CompressionCtor) return { blob: file, compressed: false };
  if (!SUPPORTED_MIME.has(file.type)) return { blob: file, compressed: false };

  try {
    const compressedBlob = await new Response(
      file.stream().pipeThrough(new CompressionCtor('gzip')),
    ).blob();
    if (compressedBlob.size < file.size * 0.98) {
      return { blob: compressedBlob, compressed: true };
    }
    return { blob: file, compressed: false };
  } catch {
    return { blob: file, compressed: false };
  }
}

function UploadProgressBar({ task }: { task: NoteUploadTask }) {
  const isError = task.status === 'error';
  const isDone = task.status === 'done';

  return (
    <div className="rounded-[10px] border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="max-w-[75%] truncate text-sm font-medium text-text-primary">
          {task.fileName}
        </span>
        <span
          className={[
            'text-xs font-semibold',
            isError ? 'text-rose-500' : isDone ? 'text-teal-600' : 'text-accent',
          ].join(' ')}
        >
          {isError ? 'Failed' : isDone ? 'Done' : `${task.progress}%`}
        </span>
      </div>
      {!isError && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
          <div
            className={[
              'h-full rounded-full transition-all duration-300',
              isDone ? 'bg-teal-500' : 'bg-accent',
            ].join(' ')}
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}
      {isError && task.errorMsg && (
        <p className="mt-1 text-xs text-rose-500">{task.errorMsg}</p>
      )}
    </div>
  );
}

export default function NotesRoutePage() {
  const { user } = useWebAuth();
  const { mirror, commitMirror, persistNow } = useMirror();

  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);

  const [uploadTasks, setUploadTasks] = useState<readonly NoteUploadTask[]>(() => getUploadTasks());
  useEffect(() => {
    return subscribeUploads(() => {
      setUploadTasks(getUploadTasks());
    });
  }, []);

  const folders = useMemo(() => mirror.noteFolders ?? [], [mirror.noteFolders]);
  const files = useMemo(() => mirror.noteFiles ?? [], [mirror.noteFiles]);

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? folders[0] ?? null;
  const selectedFiles = files.filter((f) => f.folderId === selectedFolder?.id);
  const folderUploads = uploadTasks.filter(
    (task) => task.folderId === selectedFolder?.id && task.status !== 'done',
  );
  const hasActiveUploads = uploadTasks.some((task) => task.status === 'uploading');

  async function createFolder() {
    const name = cleanName(folderName);
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;

    const existing = folders.find((folder) => folder.slug === slug);
    if (existing) {
      setSelectedFolderId(existing.id);
      setFolderName('');
      return;
    }

    const now = new Date().toISOString();
    const row: NoteFolder = {
      id: nextNumericId(folders),
      name,
      slug,
      createdAt: now,
      updatedAt: now,
    };

    setCreatingFolder(true);
    setMsg(null);
    commitMirror((prev) => ({
      ...prev,
      noteFolders: [...(prev.noteFolders ?? []), row],
    }));
    setSelectedFolderId(row.id);
    setFolderName('');

    try {
      if (user) {
        await saveNoteFolderMetadata(user.uid, row);
      }
    } catch (error) {
      setMsg(
        error instanceof Error
          ? `Folder saved locally, but cloud metadata failed: ${error.message}`
          : 'Folder saved locally, but cloud metadata failed.',
      );
    } finally {
      setCreatingFolder(false);
    }
  }

  async function uploadFiles(list: FileList | File[]) {
    if (!user || !selectedFolder) return;

    const incoming = Array.from(list);
    if (incoming.length === 0) return;

    setMsg(null);

    let nextFileId = nextNumericId(files);
    const useFirebaseStorage = publicFileStorageMode() === 'firebase';

    for (const file of incoming) {
      if (!SUPPORTED_MIME.has(file.type) || !SUPPORTED_EXTENSIONS.has(extFromName(file.name))) {
        setMsg(`Skipped "${file.name}" — only PDF, PPT, and PPTX files are supported.`);
        continue;
      }

      const before = notesRejectReasonBeforeCompress(file);
      if (before) {
        setMsg(before);
        continue;
      }

      const { blob, compressed } = useFirebaseStorage
        ? { blob: file as Blob, compressed: false }
        : await gzipBlobIfPossible(file);
      const after = notesRejectReasonAfterCompress(file.name, blob);
      if (after) {
        setMsg(after);
        continue;
      }

      const fileId = nextFileId;
      nextFileId += 1;
      const safeFileName = buildNoteStorageFileName(file.name);
      const storagePath = buildNoteStoragePath(user.uid, selectedFolder.id, safeFileName);
      const folderId = selectedFolder.id;
      const createdAt = new Date().toISOString();
      const contentType = compressed ? 'application/gzip' : file.type;

      startNoteUpload({
        blob,
        storagePath,
        fileName: file.name,
        contentType,
        folderId,
        onComplete: (downloadUrl) => {
          const row: NoteFile = {
            id: fileId,
            folderId,
            name: file.name,
            originalName: file.name,
            safeFileName,
            extension: extFromName(file.name) || null,
            sizeBytes: file.size,
            storagePath,
            downloadUrl,
            downloadURL: downloadUrl,
            compressed: compressed ? 1 : 0,
            mimeType: file.type || null,
            contentType: file.type || null,
            createdAt,
            updatedAt: createdAt,
            storageProvider: isLocalNoteUrl(downloadUrl) ? 'local' : 'firebase',
          };

          commitMirror((prev) => ({
            ...prev,
            noteFiles: [...(prev.noteFiles ?? []), row],
          }));

          void (async () => {
            try {
              await saveNoteFileMetadata(user.uid, row);
            } catch (error) {
              setMsg(
                error instanceof Error
                  ? `Uploaded "${file.name}", but metadata sync failed: ${error.message}`
                  : `Uploaded "${file.name}", but metadata sync failed.`,
              );
            }
          })();
        },
        onError: (errMsg) => {
          setMsg(`Upload failed for "${file.name}": ${errMsg}`);
        },
      });
    }
  }

  async function openLocalFile(file: NoteFile) {
    const stored = await getLocalNoteFile(storagePathFromLocalNoteUrl(file.downloadUrl));
    if (!stored) {
      setMsg(`"${file.name}" is saved only on the browser where it was uploaded.`);
      return;
    }

    let blobToOpen = stored.blob;
    if (file.compressed === 1) {
      const DecompressionCtor = (
        window as unknown as { DecompressionStream?: new (format: string) => DecompressionStream }
      ).DecompressionStream;
      if (DecompressionCtor) {
        const stream = stored.blob.stream().pipeThrough(new DecompressionCtor('gzip'));
        blobToOpen = await new Response(stream).blob();
      }
    }

    const url = URL.createObjectURL(
      new Blob([blobToOpen], {
        type: file.mimeType || file.contentType || stored.contentType || 'application/octet-stream',
      }),
    );
    triggerFileDownload(url, file.name);
    window.setTimeout(() => URL.revokeObjectURL(url), 45_000);
  }

  async function deleteFile(file: NoteFile) {
    if (!window.confirm(`Delete "${file.name}"?`)) return;

    setDeletingFileId(file.id);
    setMsg(null);
    const localOnly = isLocalOnlyFile(file);
    const firebaseBacked = isFirebaseBackedFile(file);
    const localMirrorKey = isLocalNoteUrl(file.downloadUrl)
      ? storagePathFromLocalNoteUrl(file.downloadUrl)
      : file.storagePath || null;

    try {
      if (process.env.NODE_ENV !== 'production') {
        console.info('[notes] delete file requested', {
          fileId: file.id,
          folderId: file.folderId,
          sourceMode: file.storageProvider ?? null,
          isLocalOnly: localOnly,
          isFirebaseBacked: firebaseBacked,
          hasStoragePath: Boolean(file.storagePath?.trim()),
          storagePath: file.storagePath || null,
          firestorePath:
            user && firebaseBacked ? noteFileDocPath(user.uid, file.folderId, file.id) : null,
          localMirrorKey,
        });
      }

      if (localOnly || firebaseBacked) {
        const storageResult = await deleteStoredNoteAsset(file);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[notes] delete file storage result', {
            fileId: file.id,
            folderId: file.folderId,
            result: storageResult.status,
            localMirrorKey: storageResult.localMirrorKey,
            storagePath: 'storagePath' in storageResult ? storageResult.storagePath : null,
          });
        }
      }

      if (user && firebaseBacked) {
        await deleteNoteFileMetadata(user.uid, file.folderId, file.id);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[notes] delete file firestore metadata', {
            fileId: file.id,
            folderId: file.folderId,
            firestorePath: noteFileDocPath(user.uid, file.folderId, file.id),
          });
        }
      }
      commitMirror((prev) => ({
        ...prev,
        noteFiles: (prev.noteFiles ?? []).filter((row) => row.id !== file.id),
      }));
      if (process.env.NODE_ENV !== 'production') {
        console.info('[notes] delete file local state updated', {
          fileId: file.id,
          folderId: file.folderId,
        });
      }
      window.setTimeout(() => {
        void persistNow();
      }, 0);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? `Could not delete "${file.name}": ${error.message}`
          : `Could not delete "${file.name}".`,
      );
    } finally {
      setDeletingFileId(null);
    }
  }

  async function deleteFolder(folder: NoteFolder) {
    const activeUploads = uploadTasks.some(
      (task) => task.folderId === folder.id && task.status === 'uploading',
    );
    if (activeUploads) {
      setMsg(`Wait for uploads in "${folder.name}" to finish before deleting the folder.`);
      return;
    }

    const folderFiles = files.filter((file) => file.folderId === folder.id);
    const message =
      folderFiles.length > 0
        ? `Delete "${folder.name}" and its ${folderFiles.length} file${folderFiles.length === 1 ? '' : 's'}?`
        : `Delete "${folder.name}"?`;
    if (!window.confirm(message)) return;

    setDeletingFolderId(folder.id);
    setMsg(null);
    const localFolderFiles = files.filter((file) => file.folderId === folder.id);
    const hasFirebaseBackedLocalFiles = localFolderFiles.some((file) => isFirebaseBackedFile(file));

    try {
      const remoteFolderExists =
        user && publicFileStorageMode() === 'firebase'
          ? await noteFolderMetadataExists(user.uid, folder.id).catch(() => false)
          : false;
      const remoteFiles =
        user && (remoteFolderExists || hasFirebaseBackedLocalFiles)
          ? await listNoteFileMetadata(user.uid, folder.id)
          : [];
      const allFolderFiles = [
        ...localFolderFiles,
        ...remoteFiles.filter(
          (remote) => !localFolderFiles.some((local) => local.id === remote.id),
        ),
      ];
      const folderHasFirebaseBackedFiles =
        hasFirebaseBackedLocalFiles || remoteFiles.some((file) => isFirebaseBackedFile(file));
      const localOnlyFolder = !remoteFolderExists && !folderHasFirebaseBackedFiles;
      const deleteFolderMetadataInFirestore = Boolean(user) && remoteFolderExists;

      if (process.env.NODE_ENV !== 'production') {
        console.info('[notes] delete folder requested', {
          folderId: folder.id,
          fileCount: allFolderFiles.length,
          sourceMode: localOnlyFolder ? 'local' : 'firebase',
          isLocalOnly: localOnlyFolder,
          remoteFolderExists,
          hasFirebaseBackedFiles: folderHasFirebaseBackedFiles,
          firestorePath:
            deleteFolderMetadataInFirestore && user ? noteFolderDocPath(user.uid, folder.id) : null,
        });
      }

      const deleteResults = await Promise.allSettled(
        allFolderFiles.map(async (file) => {
          const localOnly = isLocalOnlyFile(file);
          const firebaseBacked = isFirebaseBackedFile(file);
          const storageResult = await deleteStoredNoteAsset(file);
          if (process.env.NODE_ENV !== 'production') {
            console.info('[notes] delete folder file storage result', {
              fileId: file.id,
              folderId: folder.id,
              sourceMode: file.storageProvider ?? null,
              isLocalOnly: localOnly,
              isFirebaseBacked: firebaseBacked,
              result: storageResult.status,
              localMirrorKey: storageResult.localMirrorKey,
              storagePath: 'storagePath' in storageResult ? storageResult.storagePath : null,
            });
          }
          if (user && firebaseBacked) {
            await deleteNoteFileMetadata(user.uid, file.folderId, file.id);
            if (process.env.NODE_ENV !== 'production') {
              console.info('[notes] delete folder file firestore metadata', {
                fileId: file.id,
                folderId: folder.id,
                firestorePath: noteFileDocPath(user.uid, file.folderId, file.id),
              });
            }
          }
        }),
      );

      const failures = deleteResults.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        const firstError = failures[0];
        const message =
          firstError.status === 'rejected' && firstError.reason instanceof Error
            ? firstError.reason.message
            : 'Folder delete failed.';
        throw new Error(message);
      }

      if (deleteFolderMetadataInFirestore && user) {
        await deleteNoteFolderMetadata(user.uid, folder.id);
        if (process.env.NODE_ENV !== 'production') {
          console.info('[notes] delete folder firestore metadata', {
            folderId: folder.id,
            firestorePath: noteFolderDocPath(user.uid, folder.id),
          });
        }
      }

      commitMirror((prev) => ({
        ...prev,
        noteFolders: (prev.noteFolders ?? []).filter((row) => row.id !== folder.id),
        noteFiles: (prev.noteFiles ?? []).filter((row) => row.folderId !== folder.id),
      }));
      if (process.env.NODE_ENV !== 'production') {
        console.info('[notes] delete folder local state updated', {
          folderId: folder.id,
          selectedFolderIdBeforeDelete: selectedFolderId,
        });
      }
      window.setTimeout(() => {
        void persistNow();
      }, 0);

      const remaining = folders.filter((row) => row.id !== folder.id);
      setSelectedFolderId(remaining[0]?.id ?? null);
    } catch (error) {
      setMsg(
        error instanceof Error
          ? `Could not delete "${folder.name}": ${error.message}`
          : `Could not delete "${folder.name}".`,
      );
    } finally {
      setDeletingFolderId(null);
    }
  }

  return (
    <div className="sc-app-page w-full min-w-0 max-w-full space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Study notes</p>
        <h1 className="sc-page-title text-text-primary">Notes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create folders and upload PDF/PPT files. Files sync to Firebase Storage when available;
          otherwise they stay in this browser only.
        </p>
      </div>

      {hasActiveUploads && (
        <div className="flex items-center gap-2 rounded-[10px] border border-accent/30 bg-accent/5 px-4 py-2 text-sm text-accent">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />
          Uploading files in the background…
        </div>
      )}

      <section className="sc-panel p-5">
        <p className="text-sm font-extrabold text-text-primary">Create a folder</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <input
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void createFolder();
            }}
            placeholder="e.g. Biology, Finals, Lectures"
            className="sc-input"
          />
          <button type="button" onClick={() => void createFolder()} className="sc-btn-primary" disabled={creatingFolder}>
            {creatingFolder ? 'Adding…' : 'Add folder'}
          </button>
        </div>
      </section>

      <div className="grid w-full min-w-0 max-w-full gap-4 md:grid-cols-[minmax(0,270px)_minmax(0,1fr)]">
        <aside className="sc-panel min-w-0 p-3">
          <p className="px-2 pb-2 text-xs text-text-muted">Folders</p>
          <div className="space-y-1">
            {folders.length === 0 ? (
              <p className="px-2 py-1 text-xs text-text-muted">No folders yet.</p>
            ) : (
              folders.map((folder) => {
                const activeCount = uploadTasks.filter(
                  (task) => task.folderId === folder.id && task.status === 'uploading',
                ).length;
                const isDeleting = deletingFolderId === folder.id;
                return (
                  <div
                    key={folder.id}
                    className={[
                      'flex min-h-[44px] items-center justify-between rounded-[13px] px-3 py-2',
                      selectedFolder?.id === folder.id
                        ? 'bg-accent-light text-accent'
                        : 'text-text-secondary hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedFolderId(folder.id)}
                      className="flex min-w-0 flex-1 items-center justify-between text-left text-sm font-bold"
                    >
                      <span className="truncate">{folder.name}</span>
                      {activeCount > 0 ? (
                        <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                          {activeCount}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteFolder(folder)}
                      aria-label={`Delete ${folder.name} folder`}
                      className="ml-3 text-xs font-extrabold opacity-75 transition hover:opacity-100"
                      disabled={isDeleting}
                    >
                      {isDeleting ? '…' : '×'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        <section className="sc-panel min-w-0 p-5">
          <p className="text-sm font-extrabold text-text-primary">
            {selectedFolder ? `Files in ${selectedFolder.name}` : 'Choose a folder'}
          </p>

          {selectedFolder ? (
            <>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void uploadFiles(e.dataTransfer.files);
                }}
                className="mt-3 flex min-h-[190px] flex-col items-center justify-center rounded-[20px] border border-dashed border-border-strong bg-surface-2 p-6 text-center"
              >
                <span className="mb-3 text-[30px] text-accent">↑</span>
                <p className="text-sm text-text-secondary">Drag and drop PDF/PPT files here</p>
                <p className="mt-1 text-xs text-text-muted">{NOTES_LIMIT_HINT}</p>
                <label className="sc-btn-secondary mt-4 cursor-pointer text-xs">
                  Choose files
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    className="hidden"
                    onChange={(e) => {
                      if (!e.target.files) return;
                      void uploadFiles(e.target.files);
                      e.currentTarget.value = '';
                    }}
                  />
                </label>
              </div>

              {msg ? <p className="mt-3 text-xs text-text-muted">{msg}</p> : null}

              {folderUploads.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-text-muted">Uploading</p>
                  {folderUploads.map((task) => (
                    <UploadProgressBar key={task.id} task={task} />
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-2">
                {selectedFiles.length === 0 && folderUploads.length === 0 ? (
                  <p className="text-sm text-text-muted">No files in this folder yet.</p>
                ) : (
                  selectedFiles.map((file) => {
                    const isLocal = isLocalNoteUrl(file.downloadUrl);
                    const isDeleting = deletingFileId === file.id;
                    return (
                      <div
                        key={file.id}
                        className="flex min-h-[58px] items-center justify-between gap-3 rounded-[16px] border border-border bg-surface-2 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text-primary">
                            {file.name}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                            {file.compressed === 1 ? ' · compressed' : ''}
                            {isLocal ? ' · local-only' : ' · synced'}
                          </span>
                        </span>
                        <div className="flex items-center gap-3">
                          {isLocal ? (
                            <button
                              type="button"
                              onClick={() => void openLocalFile(file)}
                              className="text-xs font-extrabold text-accent"
                            >
                              Open
                            </button>
                          ) : (
                            <a
                              href={file.downloadURL ?? file.downloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-extrabold text-accent"
                            >
                              Download
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() => void deleteFile(file)}
                            className="text-xs font-extrabold text-text-muted transition hover:text-rose-500"
                            disabled={isDeleting}
                          >
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Create a folder first to upload files.</p>
          )}
        </section>
      </div>
    </div>
  );
}
