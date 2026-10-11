/** Bytes → base64 without blowing the call stack on large images (chunked String.fromCharCode). */
export function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Only our own JPEG uploads are accepted: `{tripId}/{name}.jpg`, no traversal. */
export function isReceiptPath(tripId: string, path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith(`${tripId}/`) &&
    !path.includes('..') &&
    /^[0-9a-f-]{36}\/[\w.-]{1,120}\.jpe?g$/i.test(path)
  );
}
