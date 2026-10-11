import { copy } from '@/copy';
import type { Member } from '@/features/trips/api';
import { toCsv } from '@/lib/csv';
import { LABELS_KO, type ExpenseCategory, type PaymentMethod } from '@/types/domain';
import type { ExpenseWithSplits } from './api';

export const EXPENSE_CSV_HEADER = [
  '날짜',
  'Day',
  '제목',
  '카테고리',
  '원금액',
  '통화',
  '환율',
  '원화금액',
  '결제수단',
  '결제자',
  '분담 내역',
] as const;

export function expensesToCsv(list: readonly ExpenseWithSplits[], members: readonly Member[]) {
  const name = (id: string) => members.find((m) => m.id === id)?.nickname ?? '?';
  return toCsv(
    EXPENSE_CSV_HEADER,
    list.map((e) => [
      e.spent_on ?? '',
      e.day_index === null ? '' : `Day ${e.day_index + 1}`,
      e.title,
      LABELS_KO[e.category as ExpenseCategory] ?? e.category,
      e.amount,
      e.currency,
      e.exchange_rate,
      e.amount_krw,
      copy.expenses.payment[e.payment_method as PaymentMethod] ?? e.payment_method,
      name(e.paid_by),
      e.expense_splits.map((s) => `${name(s.member_id)} ${s.share_krw}`).join('; '),
    ]),
  );
}
