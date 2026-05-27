'use client';

import JSZip from 'jszip';
import mammoth from 'mammoth';

import {
  extensionFromFileName,
  isExtractableStudyFile,
  isPlainTextStudyFile,
  STUDY_EXTRACT_MAX_BYTES,
  studyFileTypeForMetadata,
} from '@/lib/study-file-extract';
import { normalizeStudyExtractedText } from '@/lib/study-file-text-normalize';
import { STUDY_SOURCE_MAX_CHARS, STUDY_SOURCE_MIN_CHARS } from '@/lib/study-tools-types';

export type StudyFileExtractionResult = {
  text: string;
  sourceName: string;
  fileType: string;
  sizeBytes: number;
  characterCount: number;
  extractionMethod: string;
  truncated: boolean;
};

let pdfWorkerConfigured = false;

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function ensurePdfWorker(): Promise<typeof import('pdfjs-dist')> {
  const pdfjs = await import('pdfjs-dist');
  if (!pdfWorkerConfigured && typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    pdfWorkerConfigured = true;
  }
  return pdfjs;
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await ensurePdfWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const parts: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum += 1) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (pageText) {
      parts.push(`[Page ${pageNum}]\n${pageText}`);
    }
  }

  await doc.destroy();
  return normalizeStudyExtractedText(parts.join('\n\n'));
}

async function extractDocxText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeStudyExtractedText(result.value ?? '');
}

async function extractPptxText(file: File): Promise<string> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /ppt\/slides\/slide\d+\.xml$/i.test(path))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const slides: string[] = [];
  let slideIndex = 0;
  for (const path of slidePaths) {
    slideIndex += 1;
    const xml = await zip.files[path].async('string');
    const texts: string[] = [];
    const regex = /<a:t[^>]*>([^<]*)<\/a:t>/g;
    let match = regex.exec(xml);
    while (match) {
      const segment = decodeXmlEntities(match[1] ?? '').trim();
      if (segment) texts.push(segment);
      match = regex.exec(xml);
    }
    if (texts.length > 0) {
      slides.push(`[Slide ${slideIndex}]\n${texts.join(' ')}`);
    }
  }

  return normalizeStudyExtractedText(slides.join('\n\n'));
}

async function extractPlainText(file: File): Promise<string> {
  const text = normalizeStudyExtractedText(await file.text());
  if (!text) {
    throw new Error('The uploaded file appears to be empty.');
  }
  return text;
}

function legacyOfficeMessage(ext: string): string {
  if (ext === 'ppt') {
    return 'Legacy .ppt text extraction is not supported yet. Please convert to .pptx or paste the notes.';
  }
  if (ext === 'doc') {
    return 'Legacy .doc text extraction is not supported yet. Please convert to .docx or paste the notes.';
  }
  return 'This file type is not supported. Upload PDF, PPTX, DOCX, or text (.txt, .md).';
}

/**
 * Extract readable text from a temporary study upload (Quiz / Flashcards).
 * Does not upload to Notes or storage.
 */
export async function extractTextFromStudyFile(file: File): Promise<StudyFileExtractionResult> {
  const ext = extensionFromFileName(file.name);
  const fileType = studyFileTypeForMetadata(file.name);

  if (ext === 'ppt' || ext === 'doc') {
    throw new Error(legacyOfficeMessage(ext));
  }

  if (!isExtractableStudyFile(file.name)) {
    throw new Error(
      'Upload PDF, PowerPoint (.pptx), Word (.docx), or text (.txt, .md). Legacy .ppt may need conversion.',
    );
  }

  if (file.size > STUDY_EXTRACT_MAX_BYTES) {
    throw new Error(
      `File is too large (max ${Math.round(STUDY_EXTRACT_MAX_BYTES / (1024 * 1024))} MB).`,
    );
  }

  let text: string;
  let extractionMethod: string;

  if (isPlainTextStudyFile(file.name)) {
    text = await extractPlainText(file);
    extractionMethod = 'plain-text';
  } else {
    switch (ext) {
      case 'pdf':
        text = await extractPdfText(file);
        extractionMethod = 'pdfjs-dist';
        break;
      case 'docx':
        text = await extractDocxText(file);
        extractionMethod = 'mammoth';
        break;
      case 'pptx':
        text = await extractPptxText(file);
        extractionMethod = 'pptx-xml';
        break;
      default:
        throw new Error(
          'Unsupported file type. Upload PDF, PPTX, DOCX, or text (.txt, .md).',
        );
    }
  }

  if (!text) {
    throw new Error(
      'No readable text was found in this file. Try a different export or paste text instead.',
    );
  }

  if (text.length < STUDY_SOURCE_MIN_CHARS) {
    throw new Error('This file did not contain enough readable text.');
  }

  let truncated = false;
  if (text.length > STUDY_SOURCE_MAX_CHARS) {
    text = text.slice(0, STUDY_SOURCE_MAX_CHARS);
    truncated = true;
  }

  return {
    text,
    sourceName: file.name,
    fileType,
    sizeBytes: file.size,
    characterCount: text.length,
    extractionMethod,
    truncated,
  };
}
