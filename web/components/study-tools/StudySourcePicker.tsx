'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { useMirror } from '@/context/mirror-context';
import { useWebAuth } from '@/lib/firebase-client';
import {
  isAllowedStudyUploadFileName,
  STUDY_UPLOAD_ACCEPT,
  STUDY_UPLOAD_MIME_HINT,
} from '@/lib/study-file-extract';
import { noteFileExtractionMessage, noteFileSupportsTextExtraction } from '@/lib/note-study-text';
import { buildStudySourceFromNoteFile } from '@/lib/study-tools-note-source';
import { extractTextFromStudyFile } from '@/lib/study-tools-text-extraction';
import { largeSourceUserNotice } from '@/lib/study-tools-text-limits';
import type { StudySourceSelection, StudySourceType } from '@/lib/study-tools-types';
import { STUDY_SOURCE_MAX_CHARS } from '@/lib/study-tools-types';
import type { NoteFile } from '@studycue/types';

type Tab = StudySourceType;

export default function StudySourcePicker({
  source: controlledSource,
  onSourceReady,
  onUploadPendingChange,
}: {
  /** When set, parent owns active source (paste / upload / notes). */
  source?: StudySourceSelection | null;
  onSourceReady: (selection: StudySourceSelection | null) => void;
  onUploadPendingChange?: (pending: boolean) => void;
}) {
  const { mirror } = useMirror();
  const { getIdToken } = useWebAuth();
  const [tab, setTab] = useState<Tab>('paste');
  const [pasteText, setPasteText] = useState('');
  const [pasteName, setPasteName] = useState('');
  const [uploadName, setUploadName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | ''>('');
  const [selectedFileId, setSelectedFileId] = useState<number | ''>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [truncateNotice, setTruncateNotice] = useState<string | null>(null);
  const [internalSource, setInternalSource] = useState<StudySourceSelection | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const isControlled = controlledSource !== undefined;
  const activeSource = isControlled ? controlledSource : internalSource;

  const uploadSourceReady =
    activeSource?.sourceType === 'upload' && Boolean(activeSource.text.trim());

  const uploadPending = tab === 'upload' && Boolean(uploadFile) && !uploadSourceReady;

  useEffect(() => {
    onUploadPendingChange?.(uploadPending);
  }, [uploadPending, onUploadPendingChange]);

  const folders = useMemo(
    () => [...(mirror.noteFolders ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [mirror.noteFolders],
  );

  const filesInFolder = useMemo(() => {
    if (selectedFolderId === '') return mirror.noteFiles ?? [];
    return (mirror.noteFiles ?? []).filter((file) => file.folderId === selectedFolderId);
  }, [mirror.noteFiles, selectedFolderId]);

  const selectedNoteFile = useMemo(() => {
    if (selectedFileId === '') return null;
    return (mirror.noteFiles ?? []).find((file) => file.id === selectedFileId) ?? null;
  }, [mirror.noteFiles, selectedFileId]);

  const sourceSizeNotice = activeSource?.text.trim()
    ? largeSourceUserNotice(activeSource.text.length)
    : null;

  function applySelection(selection: StudySourceSelection | null) {
    if (!isControlled) {
      setInternalSource(selection);
    }
    onSourceReady(selection);
  }

  async function loadFromPaste() {
    setError(null);
    const text = pasteText.trim();
    if (!text) {
      setError('Paste some study material first.');
      applySelection(null);
      return;
    }
    if (text.length > STUDY_SOURCE_MAX_CHARS) {
      setError(`Text must be under ${STUDY_SOURCE_MAX_CHARS.toLocaleString()} characters.`);
      applySelection(null);
      return;
    }
    applySelection({
      sourceType: 'paste',
      sourceName: pasteName.trim() || 'Pasted notes',
      text,
    });
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function handleUploadFileChange(file: File | null) {
    if (file && !isAllowedStudyUploadFileName(file.name)) {
      setError(
        'This file type is not supported yet. Try PDF, DOCX, PPTX, TXT, or MD.',
      );
      setUploadFile(null);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
      return;
    }
    setUploadFile(file);
    setError(null);
    setTruncateNotice(null);
    if (file && activeSource) {
      applySelection(null);
    } else if (!file && activeSource?.sourceType === 'upload') {
      applySelection(null);
    }
  }

  function resetUploadSelection() {
    setUploadFile(null);
    setUploadName('');
    setError(null);
    setTruncateNotice(null);
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    if (activeSource?.sourceType === 'upload') {
      applySelection(null);
    }
  }

  async function loadFromUpload() {
    setError(null);
    setTruncateNotice(null);
    if (!uploadFile) {
      setError('Choose a file to upload.');
      applySelection(null);
      return;
    }
    setLoading(true);
    try {
      const result = await extractTextFromStudyFile(uploadFile);
      if (result.truncated) {
        setTruncateNotice(
          `Using the first ${result.characterCount.toLocaleString()} characters (the file had more).`,
        );
      }
      applySelection({
        sourceType: 'upload',
        sourceName: uploadName.trim() || result.sourceName,
        text: result.text,
        fileType: result.fileType,
        fileSizeBytes: result.sizeBytes,
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : '';
      setError(
        message
          ? message
          : 'Could not read text from this file. Try another file or paste the notes.',
      );
      applySelection(null);
    } finally {
      setLoading(false);
    }
  }

  function handleUploadPrimaryAction() {
    if (uploadSourceReady) return;
    if (!uploadFile) {
      uploadInputRef.current?.click();
      return;
    }
    void loadFromUpload();
  }

  async function loadFromNotes() {
    setError(null);
    if (!selectedNoteFile) {
      setError('Select a note file.');
      applySelection(null);
      return;
    }
    setLoading(true);
    try {
      const folder = folders.find((row) => row.id === selectedNoteFile.folderId);
      const selection = await buildStudySourceFromNoteFile(selectedNoteFile, folder?.name, {
        getIdToken,
      });
      applySelection(selection);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not read text from this note file.');
      applySelection(null);
    } finally {
      setLoading(false);
    }
  }

  function renderNoteFileOption(file: NoteFile) {
    const unsupported = noteFileExtractionMessage(file);
    return (
      <option key={file.id} value={file.id} disabled={Boolean(unsupported)}>
        {file.name}
        {unsupported ? ' (text extraction unavailable)' : ''}
      </option>
    );
  }

  return (
    <div className="space-y-4 rounded-[16px] border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap gap-2">
        {(['paste', 'upload', 'notes'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold capitalize',
              tab === value
                ? 'bg-accent text-white'
                : 'border border-border bg-surface text-text-secondary',
            ].join(' ')}
          >
            {value === 'notes' ? 'From Notes' : value}
          </button>
        ))}
      </div>

      {tab === 'paste' ? (
        <div className="space-y-3">
          <input
            value={pasteName}
            onChange={(e) => setPasteName(e.target.value)}
            placeholder="Source name (optional)"
            className="sc-input w-full"
          />
          <textarea
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={8}
            placeholder="Paste your notes here…"
            className="sc-input w-full"
          />
          <button type="button" onClick={() => void loadFromPaste()} className="sc-btn-primary">
            Use pasted text
          </button>
        </div>
      ) : null}

      {tab === 'upload' ? (
        <div className="space-y-3">
          <input
            ref={uploadInputRef}
            type="file"
            accept={STUDY_UPLOAD_ACCEPT}
            className="sr-only"
            onChange={(e) => handleUploadFileChange(e.target.files?.[0] ?? null)}
          />
          <input
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="Source name (optional)"
            className="sc-input w-full"
            disabled={uploadSourceReady}
          />
          <p className="text-xs text-text-muted">
            {STUDY_UPLOAD_MIME_HINT} One-time study input only — not saved to Notes or storage quota.
          </p>

          {uploadSourceReady ? (
            <div className="rounded-[12px] border border-emerald-500/30 bg-emerald-50 px-3 py-3 dark:bg-emerald-950/30">
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                File ready: {activeSource?.sourceName}
              </p>
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                Extracted {activeSource?.text.length.toLocaleString()} characters · Ready to generate
              </p>
              {truncateNotice ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">{truncateNotice}</p>
              ) : null}
              {sourceSizeNotice && !truncateNotice ? (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-200">{sourceSizeNotice}</p>
              ) : null}
              {sourceSizeNotice && truncateNotice ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-200">{sourceSizeNotice}</p>
              ) : null}
              <button
                type="button"
                onClick={resetUploadSelection}
                className="sc-btn-secondary mt-3 text-xs"
              >
                Change file
              </button>
            </div>
          ) : (
            <>
              {uploadFile ? (
                <div className="rounded-[12px] border border-border bg-surface px-3 py-2 text-sm">
                  <p className="font-semibold text-text-primary">{uploadFile.name}</p>
                  <p className="text-xs text-text-muted">{formatFileSize(uploadFile.size)}</p>
                </div>
              ) : (
                <p className="text-sm text-text-secondary">No file selected yet.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleUploadPrimaryAction}
                  className="sc-btn-primary disabled:opacity-60"
                >
                  {loading
                    ? 'Reading file...'
                    : uploadFile
                      ? 'Use selected file'
                      : 'Choose file'}
                </button>
                {uploadFile ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => uploadInputRef.current?.click()}
                    className="sc-btn-secondary disabled:opacity-60"
                  >
                    Choose different file
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'notes' ? (
        <div className="space-y-3">
          <select
            value={selectedFolderId === '' ? '' : String(selectedFolderId)}
            onChange={(e) => {
              setSelectedFolderId(e.target.value ? Number(e.target.value) : '');
              setSelectedFileId('');
            }}
            className="sc-input w-full"
          >
            <option value="">All folders</option>
            {folders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
          <select
            value={selectedFileId === '' ? '' : String(selectedFileId)}
            onChange={(e) => setSelectedFileId(e.target.value ? Number(e.target.value) : '')}
            className="sc-input w-full"
          >
            <option value="">Select a note file</option>
            {filesInFolder.map((file) => renderNoteFileOption(file))}
          </select>
          {selectedNoteFile && !noteFileSupportsTextExtraction(selectedNoteFile) ? (
            <p className="text-xs text-amber-700 dark:text-amber-200">
              {noteFileExtractionMessage(selectedNoteFile)}
            </p>
          ) : null}
          <button
            type="button"
            disabled={loading || Boolean(selectedNoteFile && noteFileExtractionMessage(selectedNoteFile))}
            onClick={() => void loadFromNotes()}
            className="sc-btn-primary disabled:opacity-60"
          >
            {loading ? 'Loading…' : 'Use selected note'}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      {activeSource && !(tab === 'upload' && uploadSourceReady) ? (
        <div className="text-xs text-emerald-700 dark:text-emerald-200">
          <p>
            {activeSource.sourceType === 'upload'
              ? `File ready: ${activeSource.sourceName}`
              : `Ready: ${activeSource.sourceName}`}{' '}
            ({activeSource.text.length.toLocaleString()} characters)
          </p>
          {sourceSizeNotice ? (
            <p className="mt-1 text-amber-700 dark:text-amber-200">{sourceSizeNotice}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
