import { extensionFromFileName } from '@/lib/study-file-extract';

/** Extensions allowed for Notes folder uploads (extension is primary; MIME is fallback). */
export const NOTES_UPLOAD_EXTENSIONS = new Set([
  'pdf',
  'ppt',
  'pptx',
  'docx',
  'txt',
  'md',
  'markdown',
]);

export const NOTES_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'text/x-markdown',
  'application/octet-stream',
]);

export const NOTES_UPLOAD_ACCEPT =
  '.pdf,.ppt,.pptx,.docx,.txt,.md,.markdown,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/x-markdown';

export const NOTES_UPLOAD_HINT =
  'Drag and drop PDF, PPTX, DOCX, TXT, or MD files here. Legacy PPT may need conversion.';

export function isNotesUploadFile(file: Pick<File, 'name' | 'type'>): boolean {
  const ext = extensionFromFileName(file.name);
  if (NOTES_UPLOAD_EXTENSIONS.has(ext)) return true;
  const mime = file.type?.trim().toLowerCase();
  if (mime && NOTES_UPLOAD_MIME_TYPES.has(mime)) {
    if (ext === 'ppt' || ext === 'pptx' || ext === 'pdf' || ext === 'docx') return true;
    if (ext === 'txt' || ext === 'md' || ext === 'markdown') return true;
    if (!ext && (mime === 'text/plain' || mime.startsWith('text/'))) return true;
  }
  return false;
}

export function notesUploadSkipMessage(fileName: string): string {
  return `Skipped "${fileName}" — supported types: PDF, PPTX, DOCX, TXT, and MD. Legacy PPT is stored but text extraction may not work.`;
}
