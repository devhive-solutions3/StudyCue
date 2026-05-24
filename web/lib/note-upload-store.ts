/**
 * Module-level singleton for tracking note file uploads.
 * Lives outside React so uploads continue even when the Notes page unmounts.
 */
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';

import { getFirebaseStorage } from '@/lib/firebase-client';
import { saveLocalNoteFile } from '@/lib/local-file-store';
import { publicFileStorageMode } from '@/lib/public-env';

export type NoteUploadTask = {
  id: string;
  fileName: string;
  folderId: number;
  /** 0–100 integer */
  progress: number;
  status: 'uploading' | 'done' | 'error';
  errorMsg?: string;
};

let _tasks: NoteUploadTask[] = [];
const _listeners = new Set<() => void>();

function notify() {
  _listeners.forEach((fn) => fn());
}

/** Subscribe to upload task changes. Returns an unsubscribe function. */
export function subscribeUploads(fn: () => void): () => void {
  _listeners.add(fn);
  return () => {
    _listeners.delete(fn);
  };
}

/** Returns a snapshot of current upload tasks. */
export function getUploadTasks(): readonly NoteUploadTask[] {
  return _tasks;
}

export type StartNoteUploadParams = {
  blob: Blob;
  storagePath: string;
  fileName: string;
  contentType: string;
  folderId: number;
  onComplete: (downloadUrl: string) => void;
  onError: (msg: string) => void;
};

/**
 * Starts a resumable Firebase Storage upload.
 * Progress and completion are tracked in the module-level store,
 * so the upload continues even if the Notes page is unmounted.
 */
export function startNoteUpload(params: StartNoteUploadParams): void {
  const { blob, storagePath, fileName, contentType, folderId, onComplete, onError } = params;

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  const entry: NoteUploadTask = { id, fileName, folderId, progress: 0, status: 'uploading' };
  _tasks = [..._tasks, entry];
  notify();

  if (publicFileStorageMode() !== 'firebase') {
    void (async () => {
      try {
        _tasks = _tasks.map((t) => (t.id === id ? { ...t, progress: 35 } : t));
        notify();
        const localUrl = await saveLocalNoteFile({ storagePath, blob, contentType, fileName });
        _tasks = _tasks.map((t) => (t.id === id ? { ...t, status: 'done', progress: 100 } : t));
        notify();
        onComplete(localUrl);
        setTimeout(() => {
          _tasks = _tasks.filter((t) => t.id !== id);
          notify();
        }, 3500);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Local upload failed';
        _tasks = _tasks.map((t) =>
          t.id === id ? { ...t, status: 'error', errorMsg: msg } : t,
        );
        notify();
        onError(msg);
      }
    })();
    return;
  }

  let uploadTask: ReturnType<typeof uploadBytesResumable>;
  try {
    const storage = getFirebaseStorage();
    const storageRef = ref(storage, storagePath);
    uploadTask = uploadBytesResumable(storageRef, blob, { contentType });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Firebase Storage is not configured';
    _tasks = _tasks.map((t) =>
      t.id === id ? { ...t, status: 'error', errorMsg: msg } : t,
    );
    notify();
    onError(msg);
    return;
  }

  uploadTask.on(
    'state_changed',
    (snapshot) => {
      const progress =
        snapshot.totalBytes > 0
          ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
          : 0;
      _tasks = _tasks.map((t) => (t.id === id ? { ...t, progress } : t));
      notify();
    },
    (error) => {
      _tasks = _tasks.map((t) =>
        t.id === id ? { ...t, status: 'error', errorMsg: error.message } : t,
      );
      notify();
      onError(error.message);
      setTimeout(() => {
        _tasks = _tasks.filter((t) => t.id !== id);
        notify();
      }, 6000);
    },
    () => {
      void (async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          _tasks = _tasks.map((t) => (t.id === id ? { ...t, status: 'done', progress: 100 } : t));
          notify();
          onComplete(downloadUrl);
          setTimeout(() => {
            _tasks = _tasks.filter((t) => t.id !== id);
            notify();
          }, 3500);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Failed to get download URL';
          _tasks = _tasks.map((t) =>
            t.id === id ? { ...t, status: 'error', errorMsg: msg } : t,
          );
          notify();
          onError(msg);
        }
      })();
    },
  );
}
