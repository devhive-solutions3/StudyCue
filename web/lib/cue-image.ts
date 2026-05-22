/** Resize schedule screenshots before Groq vision / Gemini (parity with mobile ~1024px JPEG). */

const CUE_IMAGE_MAX_INPUT_BYTES = 8 * 1024 * 1024;
const CUE_IMAGE_MAX_EDGE_PX = 1024;
const CUE_IMAGE_JPEG_QUALITY = 0.72;

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Could not compress image.'))),
      'image/jpeg',
      quality,
    );
  });
}

function readFileAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Could not read image.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image.'));
    reader.readAsDataURL(blob);
  });
}

export type CueScheduleImage = {
  mimeType: string;
  dataUrl: string;
  previewUrl: string;
};

export function isCueImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

export async function prepareCueScheduleImage(file: File): Promise<CueScheduleImage> {
  if (!isCueImageFile(file)) {
    throw new Error('Please choose a JPG, PNG, or WebP schedule image.');
  }
  if (file.size > CUE_IMAGE_MAX_INPUT_BYTES) {
    throw new Error('Image is too large. Use a screenshot under 8 MB or crop it first.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, CUE_IMAGE_MAX_EDGE_PX / longest);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image.');
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob = await canvasToJpegBlob(canvas, CUE_IMAGE_JPEG_QUALITY);
    const dataUrl = await readFileAsDataUrl(blob);
    const previewUrl = URL.createObjectURL(blob);
    return { mimeType: 'image/jpeg', dataUrl, previewUrl };
  } finally {
    bitmap.close();
  }
}

export function revokeCueScheduleImagePreview(img: CueScheduleImage | null | undefined) {
  if (img?.previewUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(img.previewUrl);
  }
}
