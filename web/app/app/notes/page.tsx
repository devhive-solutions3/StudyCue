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
  getUploadTasks,
  startNoteUpload,
  subscribeUploads,
  type NoteUploadTask,
} from '@/lib/note-upload-store';
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

function sanitizeStorageFileName(name: string) {
  return name
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
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
  const { mirror, commitMirror } = useMirror();

  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Subscribe to the module-level upload store so progress updates render here
  const [uploadTasks, setUploadTasks] = useState<readonly NoteUploadTask[]>(() =>
    getUploadTasks(),
  );
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
    (t) => t.folderId === selectedFolder?.id && t.status !== 'done',
  );
  const hasActiveUploads = uploadTasks.some((t) => t.status === 'uploading');

  function createFolder() {
    const name = cleanName(folderName);
    if (!name) return;
    const slug = slugify(name);
    if (!slug) return;

    let createdId: number | null = null;
    commitMirror((prev) => {
      const noteFolders = prev.noteFolders ?? [];
      if (noteFolders.some((f) => f.slug === slug)) return prev;
      createdId = nextNumericId(noteFolders);
      const row: NoteFolder = {
        id: createdId,
        name,
        slug,
        createdAt: new Date().toISOString(),
      };
      return { ...prev, noteFolders: [...noteFolders, row] };
    });
    if (createdId != null) setSelectedFolderId(createdId);
    setFolderName('');
  }

  async function uploadFiles(list: FileList | File[]) {
    if (!user || !selectedFolder) return;
    const incoming = Array.from(list);
    if (incoming.length === 0) return;

    setMsg(null);

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

      const { blob, compressed } = await gzipBlobIfPossible(file);
      const after = notesRejectReasonAfterCompress(file.name, blob);
      if (after) {
        setMsg(after);
        continue;
      }

      // Capture values for callbacks (closure – safe to use after navigation)
      const fileId = nextNumericId([
        ...(mirror.noteFiles ?? []),
      ]);
      const safeStorageName = sanitizeStorageFileName(file.name) || 'note-file';
      const storagePath = `${user.uid}/notes/${selectedFolder.slug}/${fileId}-${safeStorageName}${compressed ? '.gz' : ''}`;
      const folderId = selectedFolder.id;
      const capturedCommit = commitMirror;

      startNoteUpload({
        blob,
        storagePath,
        fileName: file.name,
        contentType: compressed ? 'application/gzip' : file.type,
        folderId,
        onComplete: (downloadUrl) => {
          const row: NoteFile = {
            id: fileId,
            folderId,
            name: file.name,
            extension: extFromName(file.name) || null,
            sizeBytes: blob.size,
            storagePath,
            downloadUrl,
            compressed: compressed ? 1 : 0,
            mimeType: file.type || null,
            createdAt: new Date().toISOString(),
          };
          capturedCommit((prev) => ({
            ...prev,
            noteFiles: [...(prev.noteFiles ?? []), row],
          }));
        },
        onError: (errMsg) => {
          setMsg(`Upload failed for "${file.name}": ${errMsg}`);
        },
      });
    }
  }

  async function openFile(file: NoteFile) {
    if (isLocalNoteUrl(file.downloadUrl)) {
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
        new Blob([blobToOpen], { type: file.mimeType || stored.contentType || 'application/octet-stream' }),
      );
      triggerFileDownload(url, file.name);
      window.setTimeout(() => URL.revokeObjectURL(url), 45_000);
      return;
    }

    if (file.compressed !== 1) {
      triggerFileDownload(file.downloadUrl, file.name);
      return;
    }

    const DecompressionCtor = (
      window as unknown as { DecompressionStream?: new (format: string) => DecompressionStream }
    ).DecompressionStream;
    if (!DecompressionCtor) {
      triggerFileDownload(file.downloadUrl, file.name);
      return;
    }

    try {
      const response = await fetch(file.downloadUrl);
      const compressedBytes = await response.arrayBuffer();
      const stream = new Response(compressedBytes).body?.pipeThrough(
        new DecompressionCtor('gzip'),
      );
      if (!stream) {
        triggerFileDownload(file.downloadUrl, file.name);
        return;
      }
      const decompressed = await new Response(stream).blob();
      const blob = new Blob([decompressed], {
        type: file.mimeType || 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      triggerFileDownload(url, file.name);
      window.setTimeout(() => URL.revokeObjectURL(url), 45_000);
    } catch {
      triggerFileDownload(file.downloadUrl, file.name);
    }
  }

  return (
    <div className="sc-app-page w-full min-w-0 max-w-full space-y-5">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-text-muted">Study notes</p>
        <h1 className="sc-page-title text-text-primary">Notes</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Create folders and upload PDF/PPT files. Files sync to cloud storage when Firebase Storage
          is enabled; otherwise they stay in this browser only.
        </p>
      </div>

      {/* Global upload indicator when user is on another page */}
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
              if (e.key === 'Enter') createFolder();
            }}
            placeholder="e.g. Biology, Finals, Lectures"
            className="sc-input"
          />
          <button
            type="button"
            onClick={createFolder}
            className="sc-btn-primary"
          >
            Add folder
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
                  (t) => t.folderId === folder.id && t.status === 'uploading',
                ).length;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={[
                      'flex min-h-[44px] w-full items-center justify-between rounded-[13px] px-3 py-2 text-left text-sm font-bold',
                      selectedFolder?.id === folder.id
                        ? 'bg-accent-light text-accent'
                        : 'text-text-secondary hover:bg-surface-2',
                    ].join(' ')}
                  >
                    <span>{folder.name}</span>
                    {activeCount > 0 && (
                      <span className="ml-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
                        {activeCount}
                      </span>
                    )}
                  </button>
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

              {/* Active uploads for this folder */}
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
                  selectedFiles.map((file) => (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => void openFile(file)}
                      className="flex min-h-[58px] w-full items-center justify-between rounded-[16px] border border-border bg-surface-2 px-3 py-2 text-left hover:bg-surface"
                    >
                      <span>
                        <span className="block text-sm font-medium text-text-primary">
                          {file.name}
                        </span>
                        <span className="block text-xs text-text-muted">
                          {(file.sizeBytes / 1024 / 1024).toFixed(2)} MB
                          {file.compressed === 1 ? ' · compressed' : ''}
                          {isLocalNoteUrl(file.downloadUrl) ? ' · browser-only' : ''}
                        </span>
                      </span>
                      <span className="text-xs text-accent">Download</span>
                    </button>
                  ))
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
