import 'server-only';

import JSZip from 'jszip';
import mammoth from 'mammoth';

import {
  extensionFromFileName,
  isPlainTextStudyFile,
  STUDY_EXTRACT_MAX_BYTES,
  studyFileTypeForMetadata,
} from '@/lib/study-file-extract';
import { normalizeStudyExtractedText } from '@/lib/study-file-text-normalize';
import { STUDY_SOURCE_MIN_CHARS } from '@/lib/study-tools-types';

export { STUDY_EXTRACT_MAX_BYTES };

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText();
    return normalizeStudyExtractedText(result.text ?? '');
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeStudyExtractedText(result.value ?? '');
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /ppt\/slides\/slide\d+\.xml$/i.test(path) || /slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const chunks: string[] = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async('string');
    const texts: string[] = [];
    const regex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let match = regex.exec(xml);
    while (match) {
      const segment = match[1]?.trim();
      if (segment) texts.push(segment);
      match = regex.exec(xml);
    }
    if (texts.length > 0) chunks.push(texts.join(' '));
  }

  return normalizeStudyExtractedText(chunks.join('\n\n'));
}

/** Legacy .ppt (binary) — not safely parseable in-process. */
function unsupportedLegacyOfficeMessage(ext: string): string {
  if (ext === 'ppt') {
    return 'Legacy .ppt text extraction is not supported yet. Please convert to .pptx or paste the notes.';
  }
  if (ext === 'doc') {
    return 'Legacy .doc text extraction is not supported yet. Please convert to .docx or paste the notes.';
  }
  return 'This file type is not supported. Try .pdf, .pptx, .docx, or paste text.';
}

export async function extractStudyFileText(params: {
  buffer: Buffer;
  fileName: string;
}): Promise<{ text: string; fileType: string }> {
  const { buffer, fileName } = params;
  const ext = extensionFromFileName(fileName);

  if (buffer.length > STUDY_EXTRACT_MAX_BYTES) {
    throw new Error(
      `File is too large to extract (max ${Math.round(STUDY_EXTRACT_MAX_BYTES / (1024 * 1024))} MB).`,
    );
  }

  if (isPlainTextStudyFile(fileName)) {
    const text = normalizeStudyExtractedText(buffer.toString('utf-8'));
    if (!text) throw new Error('The file appears to be empty.');
    return { text, fileType: studyFileTypeForMetadata(fileName) };
  }

  let text = '';

  switch (ext) {
    case 'pdf':
      text = await extractPdfText(buffer);
      break;
    case 'pptx':
      text = await extractPptxText(buffer);
      break;
    case 'docx':
      text = await extractDocxText(buffer);
      break;
    case 'ppt':
    case 'doc':
      throw new Error(unsupportedLegacyOfficeMessage(ext));
    default:
      throw new Error(
        'Unsupported file type. Upload PDF, PPTX, DOCX, or text (.txt, .md).',
      );
  }

  if (!text) {
    throw new Error(
      'No readable text was found in this file. Try a different export or paste text instead.',
    );
  }

  if (text.length < STUDY_SOURCE_MIN_CHARS) {
    throw new Error('This file did not contain enough readable text.');
  }

  return { text, fileType: studyFileTypeForMetadata(fileName) };
}
