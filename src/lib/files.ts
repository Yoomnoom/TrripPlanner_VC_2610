export const MAX_FILE_BYTES = 20 * 1024 * 1024;

const ALLOWED_PREFIXES = ['image/'];
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export type UploadCheck = { ok: true } | { ok: false; reason: 'too_large' | 'type' | 'empty' };

/** Client-side gate before uploading (the bucket also enforces 20MB). */
export function checkUpload(file: { size: number; type: string }): UploadCheck {
  if (file.size === 0) return { ok: false, reason: 'empty' };
  if (file.size > MAX_FILE_BYTES) return { ok: false, reason: 'too_large' };
  const t = file.type.toLowerCase();
  return ALLOWED_TYPES.has(t) || ALLOWED_PREFIXES.some((p) => t.startsWith(p))
    ? { ok: true }
    : { ok: false, reason: 'type' };
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/** Keeps the extension, strips path separators and characters storage keys dislike (Korean is fine). */
export function sanitizeFilename(name: string) {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  const cleaned = base
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '_')
    .replace(/^[._]+/, '')
    .slice(-100);
  return cleaned || 'file';
}

/** `{trip_id}/{uuid}-{filename}` — the first segment is what the storage policy checks. */
export const filePath = (tripId: string, id: string, filename: string) =>
  `${tripId}/${id}-${sanitizeFilename(filename)}`;

/** `{trip_id}/{uuid}.jpg` for receipts. */
export const receiptPath = (tripId: string, id: string) => `${tripId}/${id}.jpg`;

/** Only http(s) links are saved; anything else (javascript:, data:) is rejected. */
export function normalizeUrl(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null;
  } catch {
    return null;
  }
}
