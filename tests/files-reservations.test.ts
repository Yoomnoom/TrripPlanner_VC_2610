import { describe, expect, it } from 'vitest';
import {
  checkUpload,
  filePath,
  formatBytes,
  MAX_FILE_BYTES,
  normalizeUrl,
  receiptPath,
  sanitizeFilename,
} from '@/lib/files';
import { fitWithin } from '@/lib/image';
import {
  formatRangeWhen,
  formatWhen,
  fromInputValue,
  isFixedItem,
  sortReservations,
  toExpensePrefill,
  toInputValue,
} from '@/lib/reservations';
import { bytesToBase64, isReceiptPath } from '../supabase/functions/_shared/base64';
import { ReceiptResult } from '@/schemas/ai';
import { RECEIPT_JSON_SCHEMA } from '../supabase/functions/_shared/prompts';
import { createFakeClient } from '../supabase/functions/_shared/ai/fake';

describe('files', () => {
  it('gates uploads by size and type', () => {
    expect(checkUpload({ size: 1000, type: 'application/pdf' })).toEqual({ ok: true });
    expect(checkUpload({ size: 1000, type: 'image/heic' })).toEqual({ ok: true });
    expect(checkUpload({ size: MAX_FILE_BYTES + 1, type: 'application/pdf' })).toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(checkUpload({ size: 10, type: 'application/x-msdownload' })).toEqual({
      ok: false,
      reason: 'type',
    });
    expect(checkUpload({ size: 0, type: 'image/png' })).toEqual({ ok: false, reason: 'empty' });
  });
  it('formats sizes', () => {
    expect(formatBytes(500)).toBe('500B');
    expect(formatBytes(2048)).toBe('2.0KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0MB');
  });
  it('sanitizes filenames and builds trip-scoped paths', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('항공권 예약 (최종).pdf')).toBe('항공권_예약_최종_.pdf');
    expect(sanitizeFilename('')).toBe('file');
    expect(filePath('t1', 'u1', 'a b.pdf')).toBe('t1/u1-a_b.pdf');
    expect(receiptPath('t1', 'u1')).toBe('t1/u1.jpg');
  });
  it('accepts only http(s) links', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a');
    expect(normalizeUrl('http://x.io')).toBe('http://x.io/');
    expect(normalizeUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeUrl('data:text/html,hi')).toBeNull();
    expect(normalizeUrl('  ')).toBeNull();
  });
});

describe('image + receipt helpers', () => {
  it('fits the long edge without upscaling', () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
  it('base64-encodes large buffers and validates receipt paths', () => {
    const big = new Uint8Array(200_000).fill(65);
    expect(bytesToBase64(big).length).toBe(Math.ceil(200_000 / 3) * 4);
    expect(bytesToBase64(new TextEncoder().encode('hi'))).toBe('aGk=');
    const t = '11111111-1111-1111-1111-111111111111';
    expect(isReceiptPath(t, `${t}/22222222-2222-2222-2222-222222222222.jpg`)).toBe(true);
    expect(isReceiptPath(t, `${t}/../x.jpg`)).toBe(false);
    expect(isReceiptPath(t, `other/abc.jpg`)).toBe(false);
    expect(isReceiptPath(t, `${t}/a.png`)).toBe(false);
    expect(isReceiptPath(t, 5)).toBe(false);
  });
  it('the fake receipt matches the schema and the JSON schema lists every field', async () => {
    const raw = await createFakeClient().call({ system: '', user: '', jsonSchema: RECEIPT_JSON_SCHEMA }, 'x');
    const r = ReceiptResult.parse(JSON.parse(raw));
    expect(r.total).toBe(1480);
    expect(RECEIPT_JSON_SCHEMA.required.sort()).toEqual(Object.keys(ReceiptResult.shape).sort());
  });
  it('validates receipt results at the boundaries', () => {
    const ok = {
      merchant: null,
      date: null,
      total: null,
      currency: null,
      categoryGuess: 'other',
      items: [],
      confidence: 0,
    };
    expect(ReceiptResult.safeParse(ok).success).toBe(true);
    expect(ReceiptResult.safeParse({ ...ok, total: -1 }).success).toBe(false);
    expect(ReceiptResult.safeParse({ ...ok, currency: 'yen' }).success).toBe(false);
    expect(ReceiptResult.safeParse({ ...ok, date: '2026/10/10' }).success).toBe(false);
    expect(ReceiptResult.safeParse({ ...ok, confidence: 1.5 }).success).toBe(false);
  });
});

describe('reservations', () => {
  const r = (id: string, starts: string | null, title = id, type = 'other') => ({
    id,
    type,
    title,
    starts_at: starts,
    ends_at: null,
    amount: null,
    currency: null,
  });
  it('sorts as a timeline with undated last', () => {
    const list = [r('c', null), r('b', '2026-10-10T09:00:00'), r('a', '2026-10-09T14:30:00')];
    expect(sortReservations(list).map((x) => x.id)).toEqual(['a', 'b', 'c']);
  });
  it('formats wall-clock times without timezone shifts', () => {
    expect(formatWhen('2026-10-09T14:30:00')).toBe('10월 9일 14:30');
    expect(formatWhen(null)).toBe('');
    expect(formatRangeWhen('2026-10-09T14:30:00', '2026-10-09T16:00:00')).toBe('10월 9일 14:30 ~ 16:00');
    expect(formatRangeWhen('2026-10-09T14:30:00', '2026-10-11T11:00:00')).toBe(
      '10월 9일 14:30 ~ 10월 11일 11:00',
    );
  });
  it('converts to and from datetime-local values', () => {
    expect(toInputValue('2026-10-09T14:30:00')).toBe('2026-10-09T14:30');
    expect(fromInputValue('2026-10-09T14:30')).toBe('2026-10-09T14:30:00');
    expect(fromInputValue('')).toBeNull();
  });
  it('maps a reservation to an expense prefill', () => {
    expect(
      toExpensePrefill({
        ...r('x', '2026-10-09T14:30:00', '항공권', 'flight'),
        amount: 250000,
        currency: 'KRW',
      }),
    ).toEqual({
      title: '항공권',
      amount: 250000,
      currency: 'KRW',
      category: 'transport',
      spent_on: '2026-10-09',
    });
    expect(toExpensePrefill(r('y', null, '식당', 'restaurant')).category).toBe('food');
    expect(isFixedItem({ type: 'lodging' })).toBe(true);
    expect(isFixedItem({ type: 'ticket' })).toBe(false);
  });
});
