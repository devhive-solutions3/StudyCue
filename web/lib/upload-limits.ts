/**
 * Tight upload caps for Firebase Storage on a small Blaze budget.
 * PDF/PPT: gzip then enforce max stored size. Profile: resize + JPEG.
 */

/** Reject huge originals before gzip work. */
export const NOTES_MAX_INPUT_BYTES = 4 * 1024 * 1024; // 4 MB

/** Max bytes stored per note file (after gzip when possible). */
export const NOTES_MAX_STORED_BYTES = 2 * 1024 * 1024; // 2 MB

/** Raw pick from file input. */
export const PROFILE_MAX_INPUT_BYTES = 3 * 1024 * 1024; // 3 MB

/** Longest side after resize. */
export const PROFILE_MAX_EDGE_PX = 256;

/** Target max stored size for avatar JPEG. */
export const PROFILE_MAX_STORED_BYTES = 200 * 1024; // 200 KB

const PROFILE_JPEG_QUALITY = 0.72;
const PROFILE_JPEG_QUALITY_LOW = 0.5;

export function formatUploadLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return mb % 1 === 0 ? `${mb} MB` : `${mb.toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export const NOTES_LIMIT_HINT = `PDF/PPT max ${formatUploadLimit(NOTES_MAX_STORED_BYTES)} each (${formatUploadLimit(NOTES_MAX_INPUT_BYTES)} before compression).`;

export const PROFILE_LIMIT_HINT = `Profile photo max ${formatUploadLimit(PROFILE_MAX_STORED_BYTES)} (saved as a small JPEG).`;

export function notesRejectReasonBeforeCompress(file: File): string | null {
  if (file.size > NOTES_MAX_INPUT_BYTES) {
    return `"${file.name}" is too large (${formatUploadLimit(file.size)}). Pick a file under ${formatUploadLimit(NOTES_MAX_INPUT_BYTES)}.`;
  }
  return null;
}

export function notesRejectReasonAfterCompress(fileName: string, blob: Blob): string | null {
  if (blob.size > NOTES_MAX_STORED_BYTES) {
    return `"${fileName}" is still ${formatUploadLimit(blob.size)} after compression. Max stored size is ${formatUploadLimit(NOTES_MAX_STORED_BYTES)} — try a shorter PDF or export slides as PDF with fewer images.`;
  }
  return null;
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not compress image.'))),
      'image/jpeg',
      quality,
    );
  });
}

/** Resize to a small square-ish avatar and return JPEG blob for Storage. */
export async function compressProfilePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Profile photo must be a JPG, PNG, or WebP image.');
  }
  if (file.size > PROFILE_MAX_INPUT_BYTES) {
    throw new Error(
      `Image is too large (${formatUploadLimit(file.size)}). Choose one under ${formatUploadLimit(PROFILE_MAX_INPUT_BYTES)}.`,
    );
  }

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, PROFILE_MAX_EDGE_PX / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image.');
    ctx.drawImage(bitmap, 0, 0, w, h);

    let blob = await canvasToJpegBlob(canvas, PROFILE_JPEG_QUALITY);
    if (blob.size > PROFILE_MAX_STORED_BYTES) {
      blob = await canvasToJpegBlob(canvas, PROFILE_JPEG_QUALITY_LOW);
    }
    if (blob.size > PROFILE_MAX_STORED_BYTES) {
      throw new Error(
        `Could not shrink photo below ${formatUploadLimit(PROFILE_MAX_STORED_BYTES)}. Try a simpler image.`,
      );
    }
    return blob;
  } finally {
    bitmap.close();
  }
}
