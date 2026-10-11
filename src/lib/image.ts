/** Scale (w,h) so the long edge is at most `max`; never upscales. */
export function fitWithin(w: number, h: number, max = 1600) {
  const long = Math.max(w, h);
  if (long <= max) return { width: w, height: h };
  const k = max / long;
  return { width: Math.round(w * k), height: Math.round(h * k) };
}

/** Browser-only: decode an image file, shrink to a 1600px long edge and re-encode as JPEG (quality 0.8). */
export async function resizeToJpeg(file: File, max = 1600, quality = 0.8): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('CANVAS_UNAVAILABLE');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('ENCODE_FAILED'))), 'image/jpeg', quality),
  );
}
