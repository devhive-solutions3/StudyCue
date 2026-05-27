/** Pure Firestore / Storage path helpers for Notes (safe for client and server). */

export function noteFoldersCollectionPath(uid: string) {
  return `users/${uid}/noteFolders`;
}

export function noteFolderDocPath(uid: string, folderId: number) {
  return `${noteFoldersCollectionPath(uid)}/${folderId}`;
}

export function noteFilesCollectionPath(uid: string, folderId: number) {
  return `${noteFolderDocPath(uid, folderId)}/files`;
}

export function noteFileDocPath(uid: string, folderId: number, fileId: number) {
  return `${noteFilesCollectionPath(uid, folderId)}/${fileId}`;
}

export function buildNoteStoragePath(uid: string, folderId: number, safeFileName: string) {
  return `users/${uid}/notes/${folderId}/${safeFileName}`;
}
