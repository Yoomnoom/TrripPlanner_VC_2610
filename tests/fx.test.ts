import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFxUrl, isCurrencyCode, parseFxResponse } from '../supabase/functions/_shared/fx';

const invoke = vi.fn();
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke } } }));

describe('fx-rate helpers', () => {
  it('validates codes and builds the URL', () => {
    expect(isCurrencyCode('JPY')).toBe(true);
    expect(isCurrencyCode('jpy')).toBe(false);
    expect(isCurrencyCode('JP&x=1')).toBe(false);
    expect(buildFxUrl('JPY')).toBe('https://api.frankfurter.dev/v1/latest?base=JPY&symbols=KRW');
  });
  it('parses the Frankfurter response and rejects bad ones', () => {
    expect(parseFxResponse({ amount: 1, base: 'JPY', date: '2026-10-09', rates: { KRW: 8.4768 } })).toEqual({
      rate: 8.4768,
      date: '2026-10-09',
    });
    expect(parseFxResponse({ message: 'not found' })).toEqual({ rate: null, date: null });
    expect(parseFxResponse({ rates: { KRW: 0 } })).toEqual({ rate: null, date: null });
    expect(parseFxResponse(null)).toEqual({ rate: null, date: null });
  });
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}

describe('getFxRate (offline fallback)', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    invoke.mockReset();
  });

  it('returns 1 for KRW without a network call', async () => {
    const { getFxRate } = await import('@/lib/fx');
    expect((await getFxRate('KRW'))?.rate).toBe(1);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('remembers the last good rate and serves it (stale) when the network fails', async () => {
    const { getFxRate } = await import('@/lib/fx');
    invoke.mockResolvedValueOnce({ data: { data: { rate: 8.5, date: '2026-10-09' } }, error: null });
    expect(await getFxRate('JPY')).toEqual({ rate: 8.5, date: '2026-10-09', stale: false });
    invoke.mockRejectedValueOnce(new Error('offline'));
    expect(await getFxRate('JPY')).toEqual({ rate: 8.5, date: '2026-10-09', stale: true });
  });

  it('is null for unsupported currencies and for a failure with nothing remembered', async () => {
    const { getFxRate } = await import('@/lib/fx');
    invoke.mockResolvedValueOnce({ data: { data: { rate: null, date: null } }, error: null });
    expect(await getFxRate('VND')).toBeNull();
    invoke.mockRejectedValueOnce(new Error('offline'));
    expect(await getFxRate('EUR')).toBeNull();
  });
});
