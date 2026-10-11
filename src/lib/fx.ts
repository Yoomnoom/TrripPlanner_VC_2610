import { supabase } from '@/lib/supabase';

export interface FxRate {
  rate: number;
  /** Date the provider quoted (YYYY-MM-DD) or when we fetched it. */
  date: string;
  /** True when this is a remembered value because the network call failed. */
  stale: boolean;
}

const key = (c: string) => `tp:fx:${c}`;

const read = (c: string): { rate: number; date: string } | null => {
  try {
    const v = JSON.parse(localStorage.getItem(key(c)) ?? 'null') as { rate?: unknown; date?: unknown } | null;
    return v && typeof v.rate === 'number' && typeof v.date === 'string'
      ? { rate: v.rate, date: v.date }
      : null;
  } catch {
    return null;
  }
};

const write = (c: string, v: { rate: number; date: string }) => {
  try {
    localStorage.setItem(key(c), JSON.stringify(v));
  } catch {
    // storage full/unavailable: the rate just won't be remembered
  }
};

/**
 * 1 `currency` = ? KRW. Network first (fx-rate Edge Function); on failure the last remembered value is
 * returned with `stale: true` (offline behaviour, SPEC F-7). `null` = unsupported and nothing remembered:
 * the form then asks for a manual rate.
 */
export async function getFxRate(currency: string): Promise<FxRate | null> {
  if (currency === 'KRW') return { rate: 1, date: new Date().toISOString().slice(0, 10), stale: false };
  try {
    if (!supabase) throw new Error('ENV_MISSING');
    const { data, error } = await supabase.functions.invoke('fx-rate', { body: { base: currency } });
    if (error) throw error;
    const r = (data as { data?: { rate: number | null; date: string | null } } | null)?.data;
    if (r?.rate) {
      const date = r.date ?? new Date().toISOString().slice(0, 10);
      write(currency, { rate: r.rate, date });
      return { rate: r.rate, date, stale: false };
    }
    return null; // provider does not support this currency
  } catch {
    const last = read(currency);
    return last ? { ...last, stale: true } : null;
  }
}
