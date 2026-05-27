'use client';

import { useMemo, useState } from 'react';

import type { NoteFolder } from '@studycue/types';

import { nextNumericId } from '@/lib/mirror-bootstrap';
import { saveNoteFolderMetadata } from '@/lib/note-storage';
import { useWebAuth } from '@/lib/firebase-client';

export type SaveStudyItemPayload = {
  title: string;
  folderId: number | null;
  folderName: string | null;
};

type Props = {
  open: boolean;
  kind: 'quiz' | 'flashcards';
  defaultTitle: string;
  defaultFolderId: number | null;
  folders: NoteFolder[];
  onClose: () => void;
  onSaved: (payload: SaveStudyItemPayload) => void | Promise<void>;
  onFolderCreated?: (folder: NoteFolder) => void;
};

export default function SaveStudyItemModal({
  open,
  kind,
  defaultTitle,
  defaultFolderId,
  folders,
  onClose,
  onSaved,
  onFolderCreated,
}: Props) {
  const { user } = useWebAuth();

  const folderNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const folder of folders) map.set(folder.id, folder.name);
    return map;
  }, [folders]);

  if (!open) return null;

  return (
    <SaveStudyItemModalForm
      key={`${defaultTitle}-${defaultFolderId ?? 'none'}`}
      kind={kind}
      defaultTitle={defaultTitle}
      defaultFolderId={defaultFolderId}
      folders={folders}
      folderNameById={folderNameById}
      onClose={onClose}
      onSaved={onSaved}
      onFolderCreated={onFolderCreated}
      user={user}
    />
  );
}

function SaveStudyItemModalForm({
  kind,
  defaultTitle,
  defaultFolderId,
  folders,
  folderNameById,
  onClose,
  onSaved,
  onFolderCreated,
  user,
}: {
  kind: 'quiz' | 'flashcards';
  defaultTitle: string;
  defaultFolderId: number | null;
  folders: NoteFolder[];
  folderNameById: Map<number, string>;
  onClose: () => void;
  onSaved: (payload: SaveStudyItemPayload) => void | Promise<void>;
  onFolderCreated?: (folder: NoteFolder) => void;
  user: ReturnType<typeof useWebAuth>['user'];
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [folderId, setFolderId] = useState<number | ''>(defaultFolderId ?? '');
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Enter a title.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      let resolvedFolderId: number | null = folderId === '' ? null : folderId;
      let resolvedFolderName: string | null =
        resolvedFolderId != null ? folderNameById.get(resolvedFolderId) ?? null : null;

      const trimmedNewFolder = newFolderName.trim();
      if (trimmedNewFolder) {
        if (!user) throw new Error('Sign in to create a folder.');
        setCreatingFolder(true);
        const now = new Date().toISOString();
        const slug = trimmedNewFolder
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
        const row = {
          id: nextNumericId(folders),
          name: trimmedNewFolder,
          slug: slug || `folder-${Date.now()}`,
          createdAt: now,
          updatedAt: now,
        };
        await saveNoteFolderMetadata(user.uid, row);
        onFolderCreated?.(row);
        resolvedFolderId = row.id;
        resolvedFolderName = row.name;
      }

      await onSaved({
        title: trimmedTitle,
        folderId: resolvedFolderId,
        folderName: resolvedFolderName,
      });
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save.');
    } finally {
      setSaving(false);
      setCreatingFolder(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[16px] border border-border bg-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-text-primary">
          Save {kind === 'quiz' ? 'quiz' : 'flashcard deck'}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">Choose a folder and title for your Notes library.</p>

        <label className="mt-4 block">
          <span className="text-sm font-semibold text-text-secondary">Title</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="sc-input mt-1 w-full"
          />
        </label>

        <label className="mt-3 block">
          <span className="text-sm font-semibold text-text-secondary">Folder</span>
          <select
            value={folderId}
            onChange={(event) =>
              setFolderId(event.target.value === '' ? '' : Number(event.target.value))
            }
            className="sc-input mt-1 w-full"
          >
            <option value="">Uncategorized</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block">
          <span className="text-sm font-semibold text-text-secondary">Or create folder</span>
          <input
            value={newFolderName}
            onChange={(event) => setNewFolderName(event.target.value)}
            placeholder="New folder name"
            className="sc-input mt-1 w-full"
          />
        </label>

        {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="sc-btn-secondary flex-1" disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            className="sc-btn-primary flex-1 disabled:opacity-60"
            disabled={saving || creatingFolder}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
