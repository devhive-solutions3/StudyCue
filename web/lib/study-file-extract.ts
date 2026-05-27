/** Study-tool upload / note read — supported file types (not Notes storage). */

export const STUDY_TEXT_EXTENSIONS = new Set(['txt', 'md', 'markdown', 'json']);

export const STUDY_EXTRACTABLE_EXTENSIONS = new Set([
  ...STUDY_TEXT_EXTENSIONS,
  'pdf',
  'pptx',
  'docx',
]);

/** Shown in file picker; legacy Office formats are rejected with a clear message. */
export const STUDY_UPLOAD_ACCEPT =
  '.txt,.md,.json,.pdf,.pptx,.docx,text/plain,text/markdown,application/json,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const STUDY_UPLOAD_MIME_HINT =
  'PDF, PowerPoint (.pptx), Word (.docx), or text (.txt, .md). Legacy .ppt may need conversion.';

export const STUDY_EXTRACT_MAX_BYTES = 15 * 1024 * 1024;

export function extensionFromFileName(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

export function isPlainTextStudyFile(name: string): boolean {
  return STUDY_TEXT_EXTENSIONS.has(extensionFromFileName(name));
}

export function isExtractableStudyFile(name: string): boolean {
  return STUDY_EXTRACTABLE_EXTENSIONS.has(extensionFromFileName(name));
}

export function studyFileTypeForMetadata(name: string): string {
  const ext = extensionFromFileName(name);
  if (ext === 'ppt' || ext === 'pptx') return 'ppt';
  if (ext === 'doc' || ext === 'docx') return 'doc';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'md' || ext === 'markdown') return 'md';
  if (ext === 'txt') return 'txt';
  if (ext === 'json') return 'json';
  return ext || 'unknown';
}
