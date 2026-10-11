import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn } from '@/components/styles';
import type { Member } from '@/features/trips/api';
import { formatKrw } from '@/lib/money';
import { computeBalances, minimizeTransfers, type Transfer } from '@/lib/settlement';
import {
  toRows,
  useAddSettlement,
  useDeleteSettlement,
  type ExpenseWithSplits,
  type Settlement,
} from './api';

/** Who owes whom: balances → minimal transfers → record/undo settlements. KRW only. */
export function SettleTab({
  tripId,
  expenses,
  settlements,
  members,
  meId,
}: {
  tripId: string;
  expenses: ExpenseWithSplits[];
  settlements: Settlement[];
  members: Member[];
  meId: string | null;
}) {
  const add = useAddSettlement(tripId);
  const del = useDeleteSettlement(tripId);
  const [confirm, setConfirm] = useState<Transfer | null>(null);

  const name = (id: string) => members.find((m) => m.id === id)?.nickname ?? '?';

  const { balances, transfers } = useMemo(() => {
    const { expenses: rows, splits } = toRows(expenses);
    const bal = computeBalances(
      members.map((m) => m.id),
      rows.map((e) => ({ id: e.id, paidBy: e.paidBy, amountKrw: e.amountKrw })),
      splits,
      settlements.map((s) => ({
        fromMember: s.from_member,
        toMember: s.to_member,
        amountKrw: Number(s.amount_krw),
      })),
    );
    return { balances: bal, transfers: minimizeTransfers(bal) };
  }, [expenses, settlements, members]);

  const max = Math.max(1, ...Object.values(balances).map((v) => Math.abs(v)));

  return (
    <div className="grid gap-3">
      <section className="rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">
          {copy.expenses.settleNow} <span className="text-primary">{transfers.length}</span>
        </h2>
        {transfers.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">{copy.expenses.allSettled}</p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {transfers.map((t) => (
              <li
                key={`${t.from}>${t.to}`}
                className="flex items-center gap-2 rounded-input border border-line p-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {name(t.from)} → {name(t.to)}
                  </span>
                  <span className="tabular block font-extrabold">{formatKrw(t.amountKrw)}</span>
                </span>
                <button type="button" className={btn.dark} onClick={() => setConfirm(t)}>
                  {copy.expenses.settle}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-card bg-surface p-4 shadow-card">
        <h2 className="font-bold">{copy.expenses.balances}</h2>
        <ul className="mt-2 grid gap-2">
          {members.map((m) => {
            const v = balances[m.id] ?? 0;
            return (
              <li key={m.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-semibold">
                    {m.nickname}
                    {m.id === meId && <span className="ml-1 text-xs text-primary">{copy.members.me}</span>}
                  </span>
                  <span className={`tabular font-bold ${v < 0 ? 'text-danger' : ''}`}>
                    {v > 0 ? '+' : ''}
                    {formatKrw(v)}
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-line" aria-hidden>
                  <div
                    className={`h-full ${v < 0 ? 'bg-danger' : 'bg-hero'}`}
                    style={{ width: `${(Math.abs(v) / max) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {settlements.length > 0 && (
        <section className="rounded-card bg-surface p-4 shadow-card">
          <h2 className="font-bold">{copy.expenses.settledList}</h2>
          <ul className="mt-2 divide-y divide-line">
            {[...settlements].reverse().map((s) => (
              <li key={s.id} className="flex min-h-12 items-center gap-2 py-1">
                <span className="min-w-0 flex-1 text-sm">
                  <span className="block truncate font-semibold">
                    {name(s.from_member)} → {name(s.to_member)}
                  </span>
                  <span className="tabular text-muted">{formatKrw(Number(s.amount_krw))}</span>
                </span>
                <button
                  type="button"
                  className={btn.ghost}
                  onClick={() => {
                    del.mutate(s.id);
                    toast(copy.expenses.settleCancelled);
                  }}
                >
                  {copy.expenses.settleCancel}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={copy.expenses.settleConfirmTitle}>
        {confirm && (
          <div className="grid gap-3">
            <p>
              {copy.expenses.settleConfirm(
                name(confirm.from),
                name(confirm.to),
                formatKrw(confirm.amountKrw),
              )}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${btn.primary} flex-1`}
                onClick={() => {
                  add.mutate({
                    id: crypto.randomUUID(),
                    from_member: confirm.from,
                    to_member: confirm.to,
                    amount_krw: confirm.amountKrw,
                  });
                  setConfirm(null);
                }}
              >
                {copy.expenses.settle}
              </button>
              <button type="button" className={`${btn.ghost} flex-1`} onClick={() => setConfirm(null)}>
                {copy.common.cancel}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
