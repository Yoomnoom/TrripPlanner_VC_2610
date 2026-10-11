/** RFC 4180 field: quote when it has a comma, quote, CR or LF; double inner quotes. */
export const csvField = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  // Neutralise spreadsheet formulas ("=", "+", "-", "@") typed into names/notes.
  const safe = /^[=+\-@]/.test(s) && Number.isNaN(Number(s)) ? `'${s}` : s;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (header: readonly string[], rows: readonly (readonly unknown[])[]) =>
  [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n');

/** UTF-8 BOM so Excel opens Korean text correctly. */
export const CSV_BOM = '﻿';

/** Triggers a browser download of CSV text. */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
