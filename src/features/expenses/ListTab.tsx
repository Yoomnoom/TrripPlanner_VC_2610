import { useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { copy } from '@/copy';
import { btn, inputCls } from '@/components/styles';
import { downloadCsv } from '@/lib/csv';
import { expensesToCsv } from './csv';
import { formatKrw, formatMoney } from '@/lib/money';
import { dayYmd, formatMdWeekday } from '@/lib/trip';
import type { Member } from '@/features/trips/api';
import { EXPENSE_CATEGORIES, LABELS_KO, type ExpenseCategory, type PaymentMethod } from '@/types/domain';
import type { ExpenseWithSplits } from './api';

export function ListTab({
  expenses,
  members,
  tripStart,
  dayCount,
  tripTitle,
  onOpen,
}: {
  expenses: ExpenseWithSplits[];
  members: Member[];
  tripStart: string;
  dayCount: number;
  tripTitle: string;
  onOpen: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [payer, setPayer] = useState('');
  const [method, setMethod] = useState('');
  const [day, setDay] = useState('');
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return expenses.filter(
      (e) =>
        (!needle || `${e.title} ${e.place_label ?? ''} ${e.memo ?? ''}`.toLowerCase().includes(needle)) &&
        (!cat || e.category === cat) &&
        (!payer || e.paid_by === payer) &&
        (!method || e.payment_method === method) &&
        (day === '' || (day === 'none' ? e.day_index === null : e.day_index === Number(day))),
    );
  }, [expenses, q, cat, payer, method, day]);

  const groups = useMemo(() => {
    const m = new Map<number | null, ExpenseWithSplits[]>();
    for (const e of filtered) m.set(e.day_index, [...(m.get(e.day_index) ?? []), e]);
    return [...m].sort((a, b) => (a[0] ?? 999) - (b[0] ?? 999));
  }, [filtered]);

  return (
    <div className="grid gap-3">
      <div className="flex gap-2">
        <input
          className={inputCls}
          type="search"
          value={q}
          placeholder={copy.expenses.search}
          aria-label={copy.expenses.search}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          type="button"
          className={btn.ghost}
          onClick={() => downloadCsv(`${tripTitle}-expenses.csv`, expensesToCsv(filtered, members))}
        >
          CSV
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          className={inputCls}
          value={cat}
          aria-label={copy.expenses.category}
          onChange={(e) => setCat(e.target.value)}
        >
          <option value="">{copy.expenses.category}</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {LABELS_KO[c]}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={payer}
          aria-label={copy.expenses.paidBy}
          onChange={(e) => setPayer(e.target.value)}
        >
          <option value="">{copy.expenses.paidBy}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nickname}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={method}
          aria-label={copy.expenses.paymentLabel}
          onChange={(e) => setMethod(e.target.value)}
        >
          <option value="">{copy.expenses.paymentLabel}</option>
          {(Object.keys(copy.expenses.payment) as PaymentMethod[]).map((p) => (
            <option key={p} value={p}>
              {copy.expenses.payment[p]}
            </option>
          ))}
        </select>
        <select
          className={inputCls}
          value={day}
          aria-label={copy.plan.day}
          onChange={(e) => setDay(e.target.value)}
        >
          <option value="">{copy.plan.day}</option>
          {Array.from({ length: dayCount }, (_, i) => (
            <option key={i} value={i}>
              {copy.plan.dayTitle(i + 1)}
            </option>
          ))}
          <option value="none">{copy.expenses.noDay}</option>
        </select>
      </div>

      {groups.length === 0 && (
        <p className="py-10 text-center text-muted">
          {expenses.length === 0 ? copy.expenses.empty : copy.expenses.noMatch}
        </p>
      )}

      {groups.map(([d, list]) => {
        const key = String(d);
        const open = !closed.has(key);
        return (
          <section key={key} className="rounded-card bg-surface p-3 shadow-card">
            <button
              type="button"
              aria-expanded={open}
              className="flex min-h-11 w-full items-center gap-2 text-left font-bold"
              onClick={() =>
                setClosed((s) => {
                  const n = new Set(s);
                  if (n.has(key)) n.delete(key);
                  else n.add(key);
                  return n;
                })
              }
            >
              <ChevronDown
                className={`size-5 transition-transform ${open ? '' : '-rotate-90'}`}
                aria-hidden
              />
              {d === null
                ? copy.expenses.noDay
                : `${copy.plan.dayTitle(d + 1)} · ${formatMdWeekday(dayYmd(tripStart, d))}`}
              <span className="ml-auto tabular text-sm font-semibold text-muted">
                {formatKrw(list.reduce((s, e) => s + Number(e.amount_krw), 0))}
              </span>
            </button>
            {open && (
              <ul className="mt-1 divide-y divide-line">
                {list.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      className="flex min-h-14 w-full items-center gap-3 py-2 text-left"
                      onClick={() => onOpen(e.id)}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{e.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {LABELS_KO[e.category as ExpenseCategory] ?? e.category}
                          {e.place_label ? ` · ${e.place_label}` : ''} ·{' '}
                          {copy.expenses.payment[e.payment_method as PaymentMethod] ?? e.payment_method}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="tabular block font-bold">{formatKrw(Number(e.amount_krw))}</span>
                        {e.currency !== 'KRW' && (
                          <span className="tabular block text-xs text-muted">
                            {formatMoney(Number(e.amount), e.currency)}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
