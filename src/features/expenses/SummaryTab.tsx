import { lazy, Suspense, useMemo, useState } from 'react';
import { copy } from '@/copy';
import { Skeleton } from '@/components/ui-kit';
import { budgetProgress, byCategory, byDay, byMember, topExpenses, totalKrw } from '@/lib/expenseStats';
import { formatKrw } from '@/lib/money';
import { computeBalances } from '@/lib/settlement';
import type { Member } from '@/features/trips/api';
import { LABELS_KO, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/types/domain';
import { toRows, type ExpenseWithSplits, type Settlement } from './api';

const Donut = lazy(() => import('./Charts').then((m) => ({ default: m.Donut })));
const DayBars = lazy(() => import('./Charts').then((m) => ({ default: m.DayBars })));

export function SummaryTab({
  expenses,
  settlements,
  members,
  meId,
  dayCount,
  budget,
  onOpen,
}: {
  expenses: ExpenseWithSplits[];
  settlements: Settlement[];
  members: Member[];
  meId: string | null;
  dayCount: number;
  budget: number | null;
  onOpen: (id: string) => void;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const { rows, splits } = useMemo(() => {
    const r = toRows(expenses);
    return { rows: r.expenses, splits: r.splits };
  }, [expenses]);

  const total = totalKrw(rows);
  const cats = useMemo(
    () => byCategory(rows).map((c) => ({ ...c, label: LABELS_KO[c.key as ExpenseCategory] ?? c.key })),
    [rows],
  );
  const burdens = useMemo(
    () =>
      byMember(splits).map((c) => ({ ...c, label: members.find((m) => m.id === c.key)?.nickname ?? '?' })),
    [splits, members],
  );
  const days = useMemo(() => byDay(rows, dayCount, filter), [rows, dayCount, filter]);
  const top = useMemo(
    () =>
      topExpenses(
        expenses.map((e, i) => ({ ...rows[i], title: e.title })),
        5,
      ),
    [expenses, rows],
  );
  const budgetInfo = budgetProgress(total, budget);

  const balances = computeBalances(
    members.map((m) => m.id),
    rows.map((e) => ({ id: e.id, paidBy: e.paidBy, amountKrw: e.amountKrw })),
    splits,
    settlements.map((s) => ({
      fromMember: s.from_member,
      toMember: s.to_member,
      amountKrw: Number(s.amount_krw),
    })),
  );
  const mine = meId ? (balances[meId] ?? 0) : 0;

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label={copy.expenses.toPay} value={formatKrw(Math.max(0, -mine))} />
        <Stat label={copy.expenses.toReceive} value={formatKrw(Math.max(0, mine))} />
        <Stat label={copy.expenses.totalSpent} value={formatKrw(total)} strong />
      </div>

      {budgetInfo && (
        <section className="rounded-card bg-surface p-4 shadow-card" aria-label={copy.expenses.budget}>
          <div className="flex justify-between text-sm font-semibold">
            <span>{copy.expenses.budget}</span>
            <span className={budgetInfo.over ? 'text-danger' : ''}>
              {budgetInfo.over
                ? copy.expenses.overBudget(formatKrw(-budgetInfo.left))
                : copy.expenses.leftBudget(formatKrw(budgetInfo.left))}
            </span>
          </div>
          <div
            className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"
            role="progressbar"
            aria-valuenow={budgetInfo.pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={`h-full ${budgetInfo.over ? 'bg-danger' : 'bg-primary'}`}
              style={{ width: `${budgetInfo.pct}%` }}
            />
          </div>
        </section>
      )}

      <Suspense fallback={<Skeleton className="h-56" />}>
        <Donut title={copy.expenses.byCategory} slices={cats} center={cats[0]?.label ?? ''} />
        <Donut title={copy.expenses.byMember} slices={burdens} center={burdens[0]?.label ?? ''} />
      </Suspense>

      <section className="rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">{copy.expenses.byDay}</h2>
        <div
          className="mt-2 flex gap-1.5 overflow-x-auto"
          role="group"
          aria-label={copy.expenses.categoryFilter}
        >
          {[null, ...EXPENSE_CATEGORIES].map((c) => (
            <button
              key={c ?? 'all'}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === c ? 'border-ink bg-ink text-white' : 'border-line'}`}
            >
              {c === null ? copy.map.all : LABELS_KO[c]}
            </button>
          ))}
        </div>
        <Suspense fallback={<Skeleton className="mt-2 h-48" />}>
          <DayBars values={days} />
        </Suspense>
      </section>

      <section className="rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">{copy.expenses.big}</h2>
        {top.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{copy.expenses.noData}</p>
        ) : (
          <>
            <p className="text-sm text-muted">{copy.expenses.bigShare(top[0].pct)}</p>
            <ul className="mt-2 grid gap-1">
              {top.map(({ expense, pct }) => (
                <li key={expense.id}>
                  <button
                    type="button"
                    className="grid min-h-11 w-full gap-1 text-left"
                    onClick={() => onOpen(expense.id)}
                  >
                    <span className="flex justify-between gap-2">
                      <span className="truncate font-semibold">{(expense as { title?: string }).title}</span>
                      <span className="tabular shrink-0 font-semibold">{formatKrw(expense.amountKrw)}</span>
                    </span>
                    <span className="h-1.5 overflow-hidden rounded-full bg-line">
                      <span className="block h-full bg-primary" style={{ width: `${pct}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`rounded-card p-3 shadow-card ${strong ? 'bg-hero text-white' : 'bg-surface'}`}>
      <p className={`text-xs ${strong ? 'text-white/70' : 'text-muted'}`}>{label}</p>
      <p className="tabular mt-1 text-sm font-extrabold sm:text-base">{value}</p>
    </div>
  );
}
