import JSZip from 'jszip';
import { PDFDocument } from 'pdf-lib';

import type { UserPlan } from '@/lib/user-plan';

export type CompressNoteFileOptions = {
  plan: UserPlan;
  maxStoredFileBytes: number;
  targetBytes?: number;
};

export type CompressNoteFileResult = {
  file: File | Blob;
  originalSizeBytes: number;
  compressedSizeBytes: number;
  compressionRatio: number;
  savedBytes: number;
  usedCompressed: boolean;
  compressionMethod: string;
  warning?: string;
};

type ImageCompressionOptions = {
  maxDimension?: number;
  jpegQuality?: number;
};

const PPTX_MIME =
  'application/vnd.openxmlformats-officedocument.presentationml.presentation';

function extensionFromName(name: string) {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.slice(idx + 1).toLowerCase() : '';
}

function normalizeMime(file: File) {
  if (file.type) return file.type;
  const ext = extensionFromName(file.name);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'ppt') return 'application/vnd.ms-powerpoint';
  if (ext === 'pptx') return PPTX_MIME;
  return 'application/octet-stream';
}

function buildCompressionResult(params: {
  output: File | Blob;
  original: File;
  method: string;
  warning?: string;
}): CompressNoteFileResult {
  const { output, original, method, warning } = params;
  const originalSizeBytes = original.size;
  const compressedSizeBytes = output.size;
  const savedBytes = Math.max(0, originalSizeBytes - compressedSizeBytes);
  const usedCompressed = compressedSizeBytes < originalSizeBytes;
  return {
    file: usedCompressed ? output : original,
    originalSizeBytes,
    compressedSizeBytes: usedCompressed ? compressedSizeBytes : originalSizeBytes,
    compressionRatio: originalSizeBytes > 0 ? (usedCompressed ? compressedSizeBytes : originalSizeBytes) / originalSizeBytes : 1,
    savedBytes: usedCompressed ? savedBytes : 0,
    usedCompressed,
    compressionMethod: usedCompressed ? method : 'original-kept',
    warning,
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  type: string,
  quality?: number,
): Promise<Blob> {
  if ('convertToBlob' in canvas) {
    return (canvas as OffscreenCanvas).convertToBlob({ type, quality });
  }

  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))),
      type,
      quality,
    );
  });
}

function createCanvas(width: number, height: number) {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function toArrayBuffer(view: Uint8Array) {
  const buffer = new ArrayBuffer(view.byteLength);
  new Uint8Array(buffer).set(view);
  return buffer;
}

export async function compressImageBlob(
  blob: Blob,
  options: ImageCompressionOptions = {},
): Promise<{ blob: Blob; changed: boolean; method: string }> {
  if (typeof createImageBitmap !== 'function') {
    return { blob, changed: false, method: 'image-original' };
  }

  const { maxDimension = 1920, jpegQuality = 0.82 } = options;
  const type = blob.type || 'application/octet-stream';
  if (!type.startsWith('image/')) {
    return { blob, changed: false, method: 'image-original' };
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > maxDimension ? maxDimension / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;
    if (!ctx) return { blob, changed: false, method: 'image-original' };
    ctx.drawImage(bitmap, 0, 0, width, height);

    if (type === 'image/jpeg' || type === 'image/jpg') {
      const reencoded = await canvasToBlob(canvas, 'image/jpeg', jpegQuality);
      if (reencoded.size < blob.size) {
        return { blob: reencoded, changed: true, method: scale < 1 ? 'image-resize-jpeg' : 'image-jpeg-reencode' };
      }
      return { blob, changed: false, method: 'image-original' };
    }

    if (type === 'image/png') {
      if (scale < 1) {
        const resized = await canvasToBlob(canvas, 'image/png');
        if (resized.size < blob.size) {
          return { blob: resized, changed: true, method: 'image-resize-png' };
        }
      }
      return { blob, changed: false, method: 'image-original' };
    }

    return { blob, changed: false, method: 'image-original' };
  } finally {
    bitmap.close();
  }
}

async function compressPdfFile(file: File) {
  const bytes = await file.arrayBuffer();
  const document = await PDFDocument.load(bytes, { updateMetadata: false });
  const output = await document.save({
    useObjectStreams: true,
    addDefaultPage: false,
    objectsPerTick: Number.POSITIVE_INFINITY,
  });
  return new File([toArrayBuffer(output)], file.name, {
    type: normalizeMime(file),
    lastModified: file.lastModified,
  });
}

async function compressPptxFile(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  let optimizedMedia = 0;

  await Promise.all(
    Object.values(zip.files).map(async (entry) => {
      if (entry.dir) return;
      if (!entry.name.startsWith('ppt/media/')) return;

      const ext = extensionFromName(entry.name);
      let mimeType: string | null = null;
      if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
      if (ext === 'png') mimeType = 'image/png';
      if (!mimeType) return;

      const blob = await entry.async('blob');
      const { blob: optimized, changed } = await compressImageBlob(
        new Blob([blob], { type: mimeType }),
        { maxDimension: 1920, jpegQuality: 0.8 },
      );
      if (!changed || optimized.size >= blob.size) return;

      zip.file(entry.name, optimized);
      optimizedMedia += 1;
    }),
  );

  const output = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  return {
    file: new File([toArrayBuffer(output)], file.name, {
      type: PPTX_MIME,
      lastModified: file.lastModified,
    }),
    optimizedMedia,
  };
}

function planWarning(plan: UserPlan, maxStoredFileBytes: number) {
  const limitMb = (maxStoredFileBytes / (1024 * 1024)).toFixed(maxStoredFileBytes % (1024 * 1024) === 0 ? 0 : 1);
  return `This file is still larger than your plan allows after compression. ${plan === 'premium' ? 'StudyCue Plus' : plan === 'beta' ? 'Beta' : 'Free'} allows up to ${limitMb} MB stored per file.`;
}

export async function compressNoteFile(
  file: File,
  options: CompressNoteFileOptions,
): Promise<CompressNoteFileResult> {
  const { plan, maxStoredFileBytes } = options;
  const ext = extensionFromName(file.name);

  try {
    if (ext === 'pdf') {
      const pdfFile = await compressPdfFile(file);
      return buildCompressionResult({
        output: pdfFile,
        original: file,
        method: 'pdf-resave-object-streams',
        warning: pdfFile.size >= file.size ? 'This PDF was already tightly compressed, so the original file was kept.' : undefined,
      });
    }

    if (ext === 'pptx') {
      const { file: pptxFile, optimizedMedia } = await compressPptxFile(file);
      return buildCompressionResult({
        output: pptxFile,
        original: file,
        method: optimizedMedia > 0 ? 'pptx-zip-media-optimize' : 'pptx-zip-repack',
        warning:
          pptxFile.size >= file.size
            ? 'This PPTX was already highly compressed, so the original file was kept.'
            : undefined,
      });
    }

    if (ext === 'ppt') {
      return {
        file,
        originalSizeBytes: file.size,
        compressedSizeBytes: file.size,
        compressionRatio: 1,
        savedBytes: 0,
        usedCompressed: false,
        compressionMethod: 'ppt-original',
        warning: 'Legacy PPT files may not compress much. Converting to PPTX usually compresses better.',
      };
    }
  } catch {
    return {
      file,
      originalSizeBytes: file.size,
      compressedSizeBytes: file.size,
      compressionRatio: 1,
      savedBytes: 0,
      usedCompressed: false,
      compressionMethod: 'compression-failed-original',
      warning:
        file.size > maxStoredFileBytes ? planWarning(plan, maxStoredFileBytes) : 'Compression failed, so the original file was kept.',
    };
  }

  return {
    file,
    originalSizeBytes: file.size,
    compressedSizeBytes: file.size,
    compressionRatio: 1,
    savedBytes: 0,
    usedCompressed: false,
    compressionMethod: 'unsupported-original',
  };
}
