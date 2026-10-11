export interface ExpenseRow {
  id: string;
  category: string;
  amountKrw: number;
  dayIndex: number | null;
  paidBy: string;
}
export interface SplitRow {
  expenseId: string;
  memberId: string;
  shareKrw: number;
}

/** Whole-number percentages that always add up to 100 (largest remainder), 0s when total is 0. */
export function percentages(values: readonly number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 100);
  const floor = raw.map(Math.floor);
  let left = 100 - floor.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => ({ i, rem: r - floor[i] })).sort((a, b) => b.rem - a.rem || a.i - b.i);
  for (const { i } of order) {
    if (left-- <= 0) break;
    floor[i]++;
  }
  return floor;
}

export function groupSum<T>(items: readonly T[], key: (t: T) => string, value: (t: T) => number) {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + value(it));
  const rows = [...m]
    .map(([k, krw]) => ({ key: k, krw }))
    .sort((a, b) => b.krw - a.krw || a.key.localeCompare(b.key));
  const pct = percentages(rows.map((r) => r.krw));
  return rows.map((r, i) => ({ ...r, pct: pct[i] }));
}

export const totalKrw = (expenses: readonly ExpenseRow[]) => expenses.reduce((s, e) => s + e.amountKrw, 0);

export const byCategory = (expenses: readonly ExpenseRow[]) =>
  groupSum(
    expenses,
    (e) => e.category,
    (e) => e.amountKrw,
  );

/** Each member's burden = sum of their shares. */
export const byMember = (splits: readonly SplitRow[]) =>
  groupSum(
    splits,
    (s) => s.memberId,
    (s) => s.shareKrw,
  );

/** Spend per trip day (index = Day - 1). Expenses without a day are not shown in the chart. */
export function byDay(expenses: readonly ExpenseRow[], dayCount: number, category?: string | null) {
  const out = Array.from({ length: dayCount }, () => 0);
  for (const e of expenses) {
    if (e.dayIndex === null || e.dayIndex < 0 || e.dayIndex >= dayCount) continue;
    if (category && e.category !== category) continue;
    out[e.dayIndex] += e.amountKrw;
  }
  return out;
}

export function topExpenses<T extends ExpenseRow>(expenses: readonly T[], n = 5) {
  const total = totalKrw(expenses);
  return [...expenses]
    .sort((a, b) => b.amountKrw - a.amountKrw || a.id.localeCompare(b.id))
    .slice(0, n)
    .map((e) => ({ expense: e, pct: total === 0 ? 0 : Math.round((e.amountKrw / total) * 100) }));
}

export function budgetProgress(total: number, budget: number | null) {
  if (!budget || budget <= 0) return null;
  return {
    pct: Math.min(100, Math.round((total / budget) * 100)),
    over: total > budget,
    left: budget - total,
  };
}
