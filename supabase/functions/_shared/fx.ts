// Pure helpers for `fx-rate` (Frankfurter v1, verified against the live API on 2026-10-12).

export const FX_BASE_URL = 'https://api.frankfurter.dev/v1/latest';

export const isCurrencyCode = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]{3}$/.test(v);

export const buildFxUrl = (base: string) => `${FX_BASE_URL}?base=${base}&symbols=KRW`;

export interface FxResult {
  rate: number | null;
  date: string | null;
}

/** `{ rate: null }` for unsupported currencies, malformed answers, or non-positive rates. */
export function parseFxResponse(json: unknown): FxResult {
  const j = json as { date?: unknown; rates?: { KRW?: unknown } } | null;
  const rate = j?.rates?.KRW;
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return { rate: null, date: null };
  return { rate, date: typeof j?.date === 'string' ? j.date : null };
}
