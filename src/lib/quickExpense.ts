import type { ExpenseInput } from '@/features/expenses/api';
import { toKrw } from '@/lib/money';
import { splitEqual } from '@/lib/settlement';
import { dayYmd } from '@/lib/trip';

export interface QuickExpenseInput {
  id: string;
  amount: number;
  currency: string;
  /** KRW per 1 unit of `currency` (1 for KRW). */
  rate: number;
  category: string;
  paidBy: string;
  memberIds: string[];
  dayIndex: number | null;
  tripStart: string;
  title?: string;
}

/**
 * The on-the-road expense: amount + category chip, split equally between everyone, paid by me, today's Day.
 * Returns null for an invalid amount/rate so the UI can keep the save button disabled.
 */
export function buildQuickExpense(i: QuickExpenseInput): ExpenseInput | null {
  if (!(i.amount > 0) || !(i.rate > 0) || i.memberIds.length === 0) return null;
  const krw = toKrw(i.amount, i.rate);
  const shares = splitEqual(krw, i.memberIds, i.paidBy);
  return {
    id: i.id,
    day_index: i.dayIndex,
    spent_on: i.dayIndex === null ? null : dayYmd(i.tripStart, i.dayIndex),
    title: i.title?.trim() || categoryTitle(i.category),
    category: i.category,
    amount: i.amount,
    currency: i.currency,
    exchange_rate: i.rate,
    amount_krw: krw,
    payment_method: 'card',
    paid_by: i.paidBy,
    place_id: null,
    place_label: null,
    memo: null,
    receipt_path: null,
    splits: Object.entries(shares).map(([member_id, share_krw]) => ({ member_id, share_krw })),
  };
}

const TITLES: Record<string, string> = {
  transport: '교통',
  lodging: '숙박',
  food: '식비',
  shopping: '쇼핑',
  ticket: '입장료',
  other: '기타',
};
export const categoryTitle = (c: string) => TITLES[c] ?? '지출';

/** Keypad state machine: digits and one decimal point, no leading zeros, capped length. */
export function keypad(current: string, key: string): string {
  if (key === 'back') return current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : current === '' ? '0.' : `${current}.`;
  if (!/^\d$/.test(key)) return current;
  if (current === '0') return key === '0' ? '0' : key;
  return current.length >= 10 ? current : current + key;
}
