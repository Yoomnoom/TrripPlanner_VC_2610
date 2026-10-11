/** `period` is stored as text: '' / null (none), 'undecided', 'YYYY', or 'YYYY-MM'. */
export type WishChoice = 'undecided' | 'thisYear' | 'nextYear' | 'custom';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function wishPeriod(choice: WishChoice, custom: string, thisYear: number): string | null {
  if (choice === 'undecided') return 'undecided';
  if (choice === 'thisYear') return String(thisYear);
  if (choice === 'nextYear') return String(thisYear + 1);
  return MONTH.test(custom) ? custom : null;
}

/** Which choice an existing period corresponds to (for editing). */
export function choiceOf(period: string | null, thisYear: number): { choice: WishChoice; custom: string } {
  if (!period || period === 'undecided') return { choice: 'undecided', custom: '' };
  if (period === String(thisYear)) return { choice: 'thisYear', custom: '' };
  if (period === String(thisYear + 1)) return { choice: 'nextYear', custom: '' };
  return { choice: 'custom', custom: MONTH.test(period) ? period : '' };
}

export function periodLabel(period: string | null): string {
  if (!period || period === 'undecided') return '시기 미정';
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}년 ${Number(m[2])}월`;
  return /^\d{4}$/.test(period) ? `${period}년` : period;
}

/** Visited month is optional: only a valid YYYY-MM is kept. */
export const visitedPeriod = (custom: string): string | null => (MONTH.test(custom) ? custom : null);
