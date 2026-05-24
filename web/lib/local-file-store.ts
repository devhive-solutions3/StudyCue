'use client';

const DB_NAME = 'studycue-local-files';
const DB_VERSION = 1;
const STORE_NAME = 'files';

type StoredFile = {
  key: string;
  blob: Blob;
  contentType: string;
  fileName: string;
  createdAt: string;
};

function canUseIndexedDb() {
  return typeof window !== 'undefined' && 'indexedDB' in window;
}

function openDb(): Promise<IDBDatabase> {
  if (!canUseIndexedDb()) {
    return Promise.reject(new Error('Local file storage is not available in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open local file storage.'));
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = run(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Local file operation failed.'));
    tx.oncomplete = () => db.close();
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error('Local file transaction failed.'));
    };
  });
}

export function localNoteUrl(storagePath: string) {
  return `studycue-local-note://${encodeURIComponent(storagePath)}`;
}

export function isLocalNoteUrl(url: string) {
  return url.startsWith('studycue-local-note://');
}

export function storagePathFromLocalNoteUrl(url: string) {
  return decodeURIComponent(url.replace('studycue-local-note://', ''));
}

export async function saveLocalNoteFile(params: {
  storagePath: string;
  blob: Blob;
  contentType: string;
  fileName: string;
}) {
  const row: StoredFile = {
    key: params.storagePath,
    blob: params.blob,
    contentType: params.contentType,
    fileName: params.fileName,
    createdAt: new Date().toISOString(),
  };
  await withStore('readwrite', (store) => store.put(row));
  return localNoteUrl(params.storagePath);
}

export async function getLocalNoteFile(storagePath: string): Promise<StoredFile | null> {
  const row = await withStore<StoredFile | undefined>('readonly', (store) => store.get(storagePath));
  return row ?? null;
}

export async function deleteLocalNoteFile(storagePath: string) {
  await withStore('readwrite', (store) => store.delete(storagePath));
}

export async function saveLocalProfilePhoto(uid: string, file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read profile image.'));
    reader.readAsDataURL(file);
  });

  window.localStorage.setItem(`studycue.profilePhoto.${uid}`, dataUrl);
  return dataUrl;
}

export function getLocalProfilePhoto(uid: string | null | undefined): string | null {
  if (!uid || typeof window === 'undefined') return null;
  return window.localStorage.getItem(`studycue.profilePhoto.${uid}`);
}
