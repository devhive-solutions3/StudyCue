'use client';

import {
  BUG_REPORT_MAX_SCREENSHOT_BYTES,
  BUG_REPORT_SCREENSHOT_TYPES,
} from '@/lib/bug-report-types';
import { formatUploadLimit } from '@/lib/upload-limits';

const BUG_REPORT_MAX_EDGE_PX = 1600;
const BUG_REPORT_JPEG_QUALITY = 0.8;

export function bugReportScreenshotRejectReason(file: File): string | null {
  if (!BUG_REPORT_SCREENSHOT_TYPES.includes(file.type as (typeof BUG_REPORT_SCREENSHOT_TYPES)[number])) {
    return 'Screenshot must be PNG, JPEG, or WebP.';
  }
  if (file.size > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
    return `Screenshot is too large (${formatUploadLimit(file.size)}). Max size is ${formatUploadLimit(BUG_REPORT_MAX_SCREENSHOT_BYTES)}.`;
  }
  return null;
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not compress screenshot.'))),
      type,
      quality,
    );
  });
}

/** Isolated screenshot compression for bug reports (not used by Notes or profile). */
export async function compressBugReportScreenshot(file: File): Promise<{
  blob: Blob;
  contentType: string;
  extension: string;
}> {
  const rejectReason = bugReportScreenshotRejectReason(file);
  if (rejectReason) throw new Error(rejectReason);

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > BUG_REPORT_MAX_EDGE_PX ? BUG_REPORT_MAX_EDGE_PX / longest : 1;
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare screenshot canvas.');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const preferWebp = file.type === 'image/webp';
    const contentType = preferWebp ? 'image/webp' : 'image/jpeg';
    const extension = preferWebp ? 'webp' : 'jpg';
    const blob = await canvasToBlob(canvas, contentType, BUG_REPORT_JPEG_QUALITY);

    if (blob.size > BUG_REPORT_MAX_SCREENSHOT_BYTES) {
      throw new Error(
        `Screenshot is still too large after compression (${formatUploadLimit(blob.size)}). Try a smaller image.`,
      );
    }

    return { blob, contentType, extension };
  } finally {
    bitmap.close();
  }
}

export function buildBugReportStoragePath(uid: string, reportId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `bugReports/${uid}/${reportId}/${safeName}`;
}

/** Upload via server API (Admin SDK) — avoids client Storage permission issues. */
export async function uploadBugReportScreenshot(params: {
  uid: string;
  reportId: string;
  file: File;
}): Promise<AttachScreenshotResult> {
  const { blob, contentType, extension } = await compressBugReportScreenshot(params.file);

  const formData = new FormData();
  formData.append('file', blob, `screenshot.${extension}`);
  formData.append('contentType', contentType);
  formData.append('originalName', params.file.name);

  const response = await fetch(
    `/api/bug-reports/${encodeURIComponent(params.reportId)}/screenshot`,
    {
      method: 'POST',
      credentials: 'same-origin',
      body: formData,
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    report?: {
      screenshotUrl: string | null;
      screenshotStoragePath: string | null;
      screenshotOriginalName: string | null;
      screenshotSizeBytes: number | null;
    };
  } | null;

  if (!response.ok) {
    throw new Error(payload?.error || `Screenshot upload failed (HTTP ${response.status}).`);
  }

  const report = payload?.report;
  if (
    !report?.screenshotUrl ||
    !report.screenshotStoragePath ||
    !report.screenshotOriginalName ||
    report.screenshotSizeBytes == null
  ) {
    throw new Error('Screenshot uploaded but metadata was not returned.');
  }

  return {
    screenshotUrl: report.screenshotUrl,
    screenshotStoragePath: report.screenshotStoragePath,
    screenshotOriginalName: report.screenshotOriginalName,
    screenshotSizeBytes: report.screenshotSizeBytes,
  };
}

export type AttachScreenshotResult = {
  screenshotUrl: string;
  screenshotStoragePath: string;
  screenshotOriginalName: string;
  screenshotSizeBytes: number;
};
