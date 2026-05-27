'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import type { NoteFile, NoteFolder } from '@studycue/types';

import NotesFolderStudyOutputs from '@/components/notes/NotesFolderStudyOutputs';
import NotesStudyPanel from '@/components/study-tools/NotesStudyPanel';
import PremiumStudyToolLockedModal from '@/components/study-tools/PremiumStudyToolLockedModal';
import { useMirror } from '@/context/mirror-context';
import { usePremiumStudyTools } from '@/hooks/use-premium-study-tools';
import { compressNoteFile } from '@/lib/file-compression';
import { getFirebaseDb, useWebAuth } from '@/lib/firebase-client';
import {
  getLocalNoteFile,
  isLocalNoteUrl,
  storagePathFromLocalNoteUrl,
} from '@/lib/local-file-store';
import { nextNumericId } from '@/lib/mirror-bootstrap';
import {
  buildNoteStorageFileName,
  buildNoteStoragePath,
  adjustUserStorageUsedBytes,
  deleteNoteFileMetadata,
  deleteNoteFolderMetadata,
  deleteStoredNoteAsset,
  listNoteFileMetadata,
  noteFolderMetadataExists,
  noteFileDocPath,
  noteFolderDocPath,
  reserveUserStorageBytes,
  saveNoteFileMetadata,
  saveNoteFolderMetadata,
} from '@/lib/note-storage';
import {
  getUploadTasks,
  startNoteUpload,
  subscribeUploads,
  type NoteUploadTask,
} from '@/lib/note-upload-store';
import {
  getMaxStoredFileBytes,
  getMaxUploadInputBytes,
  getPlanConfigForProfile,
  getStorageLimitBytes,
  getUserPlan,
} from '@/lib/plan-access';
import { publicFileStorageMode } from '@/lib/public-env';
import { formatUploadLimit } from '@/lib/upload-limits';
import { noteFileExtractionMessage, noteFileSupportsTextExtraction } from '@/lib/note-study-text';
import { buildStudySourceFromNoteFile } from '@/lib/study-tools-note-source';
import { saveStudySourceToSession } from '@/lib/study-source-session';
import {
  deleteFlashcardDeck,
  deleteSavedQuiz,
  listFlashcardDecks,
  listSavedQuizzes,
} from '@/lib/study-tools-client';
import type { SavedFlashcardDeck, SavedQuiz } from '@/lib/study-tools-types';

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

function formatCompressionMessage(params: {
  fileName: string;
  originalSizeBytes: number;
  storedSizeBytes: number;
  savedBytes: number;
  compressionMethod: string;
  warning?: string;
}) {
  const { fileName, originalSizeBytes, storedSizeBytes, savedBytes, compressionMethod, warning } = params;
  if (savedBytes > 0) {
    return `Compressed "${fileName}" from ${formatUploadLimit(originalSizeBytes)} to ${formatUploadLimit(storedSizeBytes)}. Saved ${formatUploadLimit(savedBytes)} via ${compressionMethod}.`;
  }
  if (warning) {
    return warning;
  }
  return `No smaller version was produced for "${fileName}", so the original file was kept.`;
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
  const router = useRouter();
  const { user } = useWebAuth();
  const { mirror, commitMirror, persistNow } = useMirror();
  const { allowed: premiumStudyTools, planLabel: studyToolsPlanLabel, loading: planLoading } =
    usePremiumStudyTools();

  const [folderName, setFolderName] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [studyPanelSource, setStudyPanelSource] = useState<{ name: string; text: string } | null>(
    null,
  );
  const [studyActionLoading, setStudyActionLoading] = useState(false);
  const [lockedFeature, setLockedFeature] = useState<string | null>(null);
  const [savedQuizzes, setSavedQuizzes] = useState<SavedQuiz[]>([]);
  const [savedDecks, setSavedDecks] = useState<SavedFlashcardDeck[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<number | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<number | null>(null);

  const [uploadTasks, setUploadTasks] = useState<readonly NoteUploadTask[]>(() => getUploadTasks());
  const [planProfile, setPlanProfile] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    return subscribeUploads(() => {
      setUploadTasks(getUploadTasks());
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const db = getFirebaseDb();
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        setPlanProfile(snapshot.exists() ? ((snapshot.data() as Record<string, unknown>) ?? null) : null);
      },
      () => {
        setPlanProfile(null);
      },
    );
  }, [user]);

  const folders = useMemo(() => mirror.noteFolders ?? [], [mirror.noteFolders]);
  const files = useMemo(() => mirror.noteFiles ?? [], [mirror.noteFiles]);
  const effectivePlanProfile = user ? planProfile : null;
  const planConfig = useMemo(() => getPlanConfigForProfile(effectivePlanProfile), [effectivePlanProfile]);
  const planLabel = useMemo(() => planConfig.displayName, [planConfig]);
  const planName = useMemo(() => getUserPlan(effectivePlanProfile), [effectivePlanProfile]);
  const storageLimitBytes = useMemo(() => getStorageLimitBytes(effectivePlanProfile), [effectivePlanProfile]);
  const maxUploadInputBytes = useMemo(() => getMaxUploadInputBytes(effectivePlanProfile), [effectivePlanProfile]);
  const maxStoredFileBytes = useMemo(() => getMaxStoredFileBytes(effectivePlanProfile), [effectivePlanProfile]);
  const storageUsedBytes = useMemo(() => {
    const value = effectivePlanProfile?.storageUsedBytes;
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }, [effectivePlanProfile]);
  const planLimitHint = useMemo(
    () =>
      `${planLabel} plan: ${formatUploadLimit(maxStoredFileBytes)} stored per file, ${formatUploadLimit(maxUploadInputBytes)} before compression, ${formatUploadLimit(storageLimitBytes)} total storage.`,
    [maxStoredFileBytes, maxUploadInputBytes, planLabel, storageLimitBytes],
  );

  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? folders[0] ?? null;
  const selectedFiles = files.filter((f) => f.folderId === selectedFolder?.id);
  const selectedFile =
    selectedFileId != null
      ? selectedFiles.find((file) => file.id === selectedFileId) ?? null
      : null;

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear study outputs when signed out
      setSavedQuizzes([]);
      setSavedDecks([]);
      return;
    }
    let cancelled = false;
    void Promise.all([listSavedQuizzes(user.uid), listFlashcardDecks(user.uid)]).then(
      ([quizzes, decks]) => {
        if (!cancelled) {
          setSavedQuizzes(quizzes);
          setSavedDecks(decks);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function refreshStudyOutputs() {
    if (!user) return;
    const [quizzes, decks] = await Promise.all([
      listSavedQuizzes(user.uid),
      listFlashcardDecks(user.uid),
    ]);
    setSavedQuizzes(quizzes);
    setSavedDecks(decks);
  }

  function requirePremiumStudyTools(featureLabel: string): boolean {
    if (planLoading) return false;
    if (premiumStudyTools) return true;
    setLockedFeature(featureLabel);
    return false;
  }

  async function runWithNoteSource(
    file: NoteFile,
    action: (source: Awaited<ReturnType<typeof buildStudySourceFromNoteFile>>) => void,
  ) {
    if (!noteFileSupportsTextExtraction(file)) {
      setMsg(
        noteFileExtractionMessage(file) ??
          'Text extraction for this file type is coming soon.',
      );
      return;
    }
    setStudyActionLoading(true);
    setMsg(null);
    try {
      const folderName = folders.find((folder) => folder.id === file.folderId)?.name;
      const source = await buildStudySourceFromNoteFile(file, folderName);
      action(source);
    } catch (error) {
      setMsg(error instanceof Error ? error.message : 'Could not read this note file.');
    } finally {
      setStudyActionLoading(false);
    }
  }

  async function handleStudyFile(file: NoteFile) {
    if (!requirePremiumStudyTools('Study')) return;
    await runWithNoteSource(file, (source) => {
      setStudyPanelSource({ name: source.sourceName, text: source.text });
    });
  }

  async function handleGenerateQuizFromFile(file: NoteFile) {
    if (!requirePremiumStudyTools('Generate Quiz')) return;
    await runWithNoteSource(file, (source) => {
      saveStudySourceToSession(source);
      router.push('/app/quiz');
    });
  }

  async function handleGenerateFlashcardsFromFile(file: NoteFile) {
    if (!requirePremiumStudyTools('Generate Flashcards')) return;
    await runWithNoteSource(file, (source) => {
      saveStudySourceToSession(source);
      router.push('/app/flashcards');
    });
  }
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
    let reservedStorageBytes = 0;

    for (const file of incoming) {
      if (!SUPPORTED_MIME.has(file.type) || !SUPPORTED_EXTENSIONS.has(extFromName(file.name))) {
        setMsg(`Skipped "${file.name}" — only PDF, PPT, and PPTX files are supported.`);
        continue;
      }

      if (file.size > maxUploadInputBytes) {
        setMsg(
          `This file is larger than your plan allows. "${file.name}" is ${formatUploadLimit(file.size)}, but ${planLabel} allows up to ${formatUploadLimit(maxUploadInputBytes)} before upload. Upgrade options are coming soon.`,
        );
        continue;
      }

      const compression = await compressNoteFile(file, {
        plan: planName,
        maxStoredFileBytes,
        targetBytes: maxStoredFileBytes,
      });
      const finalUpload = compression.file;
      const storedSizeBytes = compression.compressedSizeBytes;
      if (storedSizeBytes > maxStoredFileBytes) {
        setMsg(
          compression.warning ||
            `This file is still larger than your plan allows after compression. "${file.name}" would store as ${formatUploadLimit(storedSizeBytes)}, but ${planLabel} allows up to ${formatUploadLimit(maxStoredFileBytes)} per file. Upgrade options are coming soon.`,
        );
        continue;
      }

      if (storageUsedBytes + reservedStorageBytes + storedSizeBytes > storageLimitBytes) {
        setMsg(
          `You’ve reached your storage limit. ${planLabel} includes ${formatUploadLimit(storageLimitBytes)} total notes/file storage. Upgrade options are coming soon.`,
        );
        continue;
      }

      const fileId = nextFileId;
      nextFileId += 1;
      const safeFileName = buildNoteStorageFileName(file.name);
      const storagePath = buildNoteStoragePath(user.uid, selectedFolder.id, safeFileName);
      const folderId = selectedFolder.id;
      const createdAt = new Date().toISOString();
      const contentType = finalUpload.type || file.type || 'application/octet-stream';

      try {
        const nextStorageUsed = await reserveUserStorageBytes(
          user.uid,
          storedSizeBytes,
          storageLimitBytes,
        );
        reservedStorageBytes += storedSizeBytes;
        setPlanProfile((prev) => ({
          ...(prev ?? {}),
          storageUsedBytes: nextStorageUsed,
        }));
      } catch (error) {
        if (error instanceof Error && error.message === 'storage_limit_exceeded') {
          setMsg(
            `You’ve reached your storage limit. ${planLabel} includes ${formatUploadLimit(storageLimitBytes)} total notes/file storage. Upgrade options are coming soon.`,
          );
          continue;
        }
        setMsg(
          error instanceof Error
            ? `Could not reserve storage for "${file.name}": ${error.message}`
            : `Could not reserve storage for "${file.name}".`,
        );
        continue;
      }

      setMsg(
        `${formatCompressionMessage({
          fileName: file.name,
          originalSizeBytes: compression.originalSizeBytes,
          storedSizeBytes,
          savedBytes: compression.savedBytes,
          compressionMethod: compression.compressionMethod,
          warning: compression.warning,
        })} Plan file limit: ${formatUploadLimit(maxStoredFileBytes)}.`,
      );

      startNoteUpload({
        blob: finalUpload,
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
            sizeBytes: storedSizeBytes,
            originalSizeBytes: compression.originalSizeBytes,
            storedSizeBytes,
            compressionSavedBytes: compression.savedBytes,
            compressionRatio: compression.compressionRatio,
            compressionMethod: compression.compressionMethod,
            compressionWarning: compression.warning ?? null,
            storagePath,
            downloadUrl,
            downloadURL: downloadUrl,
            compressed: compression.usedCompressed ? 1 : 0,
            mimeType: file.type || null,
            contentType,
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
              const storageAfter =
                typeof planProfile?.storageUsedBytes === 'number'
                  ? planProfile.storageUsedBytes + storedSizeBytes
                  : storedSizeBytes;
              void fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({
                  eventType: 'note_upload',
                  feature: 'notes',
                  route: '/app/notes',
                  metadata: {
                    fileType: extFromName(file.name) || 'pdf',
                    storedSizeBytes,
                    compressionSavedBytes: compression.savedBytes,
                    storageUsedBytes: storageAfter,
                  },
                }),
              }).catch(() => {});
            } catch (error) {
              await deleteStoredNoteAsset(row).catch(() => {});
              const nextStorageUsed = await adjustUserStorageUsedBytes(user.uid, -storedSizeBytes).catch(
                () => null,
              );
              if (typeof nextStorageUsed === 'number') {
                setPlanProfile((prev) => ({
                  ...(prev ?? {}),
                  storageUsedBytes: nextStorageUsed,
                }));
              }
              commitMirror((prev) => ({
                ...prev,
                noteFiles: (prev.noteFiles ?? []).filter((existing) => existing.id !== row.id),
              }));
              setMsg(
                error instanceof Error
                  ? `Upload rolled back for "${file.name}" because metadata sync failed: ${error.message}`
                  : `Upload rolled back for "${file.name}" because metadata sync failed.`,
              );
            }
          })();
        },
        onError: (errMsg) => {
          void adjustUserStorageUsedBytes(user.uid, -storedSizeBytes)
            .then((nextStorageUsed) => {
              setPlanProfile((prev) => ({
                ...(prev ?? {}),
                storageUsedBytes: nextStorageUsed,
              }));
            })
            .catch(() => {});
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
    const usesLegacyGzip =
      (file.compressionMethod === 'gzip' || file.contentType === 'application/gzip') &&
      file.compressed === 1;
    if (usesLegacyGzip) {
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
      if (user) {
        const decrementBytes =
          typeof file.sizeBytes === 'number' && Number.isFinite(file.sizeBytes) ? file.sizeBytes : 0;
        if (decrementBytes > 0) {
          const nextStorageUsed = await adjustUserStorageUsedBytes(user.uid, -decrementBytes);
          setPlanProfile((prev) => ({
            ...(prev ?? {}),
            storageUsedBytes: nextStorageUsed,
          }));
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[notes] delete file missing sizeBytes; storage counter not decremented', {
            fileId: file.id,
            folderId: file.folderId,
          });
        }
      }
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
      if (user) {
        const reclaimedBytes = allFolderFiles.reduce((sum, file) => {
          const fileSize =
            typeof file.sizeBytes === 'number' && Number.isFinite(file.sizeBytes) ? file.sizeBytes : 0;
          return sum + Math.max(0, fileSize);
        }, 0);
        if (reclaimedBytes > 0) {
          const nextStorageUsed = await adjustUserStorageUsedBytes(user.uid, -reclaimedBytes);
          setPlanProfile((prev) => ({
            ...(prev ?? {}),
            storageUsedBytes: nextStorageUsed,
          }));
        } else if (process.env.NODE_ENV !== 'production') {
          console.warn('[notes] delete folder missing file sizes; storage counter unchanged', {
            folderId: folder.id,
          });
        }
      }
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
          Create folders and upload PDF, PPT, and PPTX files. Files sync to Firebase Storage when available;
          otherwise they stay in this browser only.
        </p>
        <p className="mt-2 text-sm text-text-secondary">{planLimitHint}</p>
        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-text-muted">
          {planName === 'premium' ? 'StudyCue Plus' : planLabel} storage used:{' '}
          {formatUploadLimit(storageUsedBytes)} / {formatUploadLimit(storageLimitBytes)}
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
                <p className="text-sm text-text-secondary">Drag and drop PDF, PPT, or PPTX files here</p>
                <p className="mt-1 text-xs text-text-muted">{planLimitHint}</p>
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

              {selectedFile ? (
                <div className="mt-4 rounded-[14px] border border-accent/30 bg-accent/5 p-3">
                  <p className="text-xs font-semibold text-text-primary">
                    Selected: <span className="text-accent">{selectedFile.name}</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={studyActionLoading}
                      onClick={() => void handleStudyFile(selectedFile)}
                      className="sc-btn-secondary text-xs disabled:opacity-60"
                    >
                      Study
                    </button>
                    <button
                      type="button"
                      disabled={studyActionLoading}
                      onClick={() => void handleGenerateQuizFromFile(selectedFile)}
                      className="sc-btn-secondary text-xs disabled:opacity-60"
                    >
                      Generate quiz
                    </button>
                    <button
                      type="button"
                      disabled={studyActionLoading}
                      onClick={() => void handleGenerateFlashcardsFromFile(selectedFile)}
                      className="sc-btn-secondary text-xs disabled:opacity-60"
                    >
                      Generate flashcards
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedFileId(null)}
                      className="text-xs font-semibold text-text-muted"
                    >
                      Clear
                    </button>
                  </div>
                  {!noteFileSupportsTextExtraction(selectedFile) ? (
                    <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                      {noteFileExtractionMessage(selectedFile)}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-text-muted">
                      Study tools use extracted text only — your note file is not changed.
                    </p>
                  )}
                </div>
              ) : null}

              <div className="mt-4 space-y-2">
                {selectedFiles.length === 0 && folderUploads.length === 0 ? (
                  <p className="text-sm text-text-muted">No files in this folder yet.</p>
                ) : (
                  selectedFiles.map((file) => {
                    const isLocal = isLocalNoteUrl(file.downloadUrl);
                    const isDeleting = deletingFileId === file.id;
                    const isSelected = selectedFileId === file.id;
                    return (
                      <div
                        key={file.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedFileId(file.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedFileId(file.id);
                          }
                        }}
                        className={[
                          'flex min-h-[58px] cursor-pointer items-center justify-between gap-3 rounded-[16px] border px-3 py-2',
                          isSelected
                            ? 'border-accent bg-accent/5'
                            : 'border-border bg-surface-2 hover:bg-surface',
                        ].join(' ')}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-text-primary">
                            {file.name}
                          </span>
                          <span className="block text-xs text-text-muted">
                            {formatUploadLimit(file.storedSizeBytes ?? file.sizeBytes)}
                            {typeof file.originalSizeBytes === 'number' &&
                            file.originalSizeBytes > (file.storedSizeBytes ?? file.sizeBytes)
                              ? ` · from ${formatUploadLimit(file.originalSizeBytes)}`
                              : ''}
                            {file.compressed === 1 ? ' · compressed' : ''}
                            {file.compressionMethod &&
                            file.compressionMethod !== 'original-kept' &&
                            file.compressionMethod !== 'ppt-original'
                              ? ` · ${file.compressionMethod}`
                              : ''}
                            {isLocal ? ' · local-only' : ' · synced'}
                          </span>
                          {typeof file.compressionSavedBytes === 'number' &&
                          file.compressionSavedBytes > 0 ? (
                            <span className="block text-[11px] text-text-muted">
                              Saved {formatUploadLimit(file.compressionSavedBytes)}
                            </span>
                          ) : file.compressionWarning ? (
                            <span className="block text-[11px] text-text-muted">
                              {file.compressionWarning}
                            </span>
                          ) : null}
                        </span>
                        <div className="flex items-center gap-3" onClick={(event) => event.stopPropagation()}>
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

              {selectedFolder ? (
                <NotesFolderStudyOutputs
                  folderId={selectedFolder.id}
                  quizzes={savedQuizzes}
                  decks={savedDecks}
                  onDeleteQuiz={(quizId) => {
                    if (!user) return;
                    void deleteSavedQuiz(user.uid, quizId).then(refreshStudyOutputs);
                  }}
                  onDeleteDeck={(deckId) => {
                    if (!user) return;
                    void deleteFlashcardDeck(user.uid, deckId).then(refreshStudyOutputs);
                  }}
                />
              ) : null}
            </>
          ) : (
            <p className="mt-3 text-sm text-text-muted">Create a folder first to upload files.</p>
          )}
        </section>
      </div>

      {studyPanelSource ? (
        <NotesStudyPanel
          sourceName={studyPanelSource.name}
          text={studyPanelSource.text}
          onClose={() => setStudyPanelSource(null)}
        />
      ) : null}

      <PremiumStudyToolLockedModal
        open={lockedFeature != null}
        featureLabel={lockedFeature ?? 'Study tools'}
        planLabel={studyToolsPlanLabel}
        onClose={() => setLockedFeature(null)}
      />
    </div>
  );
}
