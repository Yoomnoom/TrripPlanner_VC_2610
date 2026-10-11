import { useMemo, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { Sheet } from '@/components/Sheet';
import { btn } from '@/components/styles';
import { ErrorState, Skeleton } from '@/components/ui-kit';
import { usePlaces } from '@/features/plan/api';
import { useMembers } from '@/features/trips/api';
import type { TripContext } from '@/features/trips/TripLayout';
import { formatKrw, formatMoney } from '@/lib/money';
import { dayYmd, formatMdWeekday, todayYmd, tripDays } from '@/lib/trip';
import { LABELS_KO, type ExpenseCategory, type PaymentMethod } from '@/types/domain';
import { useDeleteExpense, useExpenses, useSaveExpense, useSettlements, type ExpenseWithSplits } from './api';
import { ExpenseForm, type FormContext } from './ExpenseForm';
import { ListTab } from './ListTab';
import { SettleTab } from './SettleTab';
import { SummaryTab } from './SummaryTab';

const TABS = ['summary', 'list', 'settle'] as const;
type Tab = (typeof TABS)[number];

export function ExpensesPage() {
  const { trip, me } = useOutletContext<TripContext>();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (TABS as readonly string[]).includes(params.get('tab') ?? '')
    ? (params.get('tab') as Tab)
    : 'summary';

  const expenses = useExpenses(trip.id);
  const settlements = useSettlements(trip.id);
  const members = useMembers(trip.id);
  const places = usePlaces(trip.id);
  const save = useSaveExpense(trip.id);
  const del = useDeleteExpense(trip.id);

  const [formOpen, setFormOpen] = useState<{ edit?: ExpenseWithSplits } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const dayCount = tripDays(trip.start_date, trip.end_date);
  const meId = members.data?.find((m) => m.user_id === me)?.id ?? null;
  const detail = expenses.data?.find((e) => e.id === detailId) ?? null;

  const ctx: FormContext | null = useMemo(() => {
    if (!members.data) return null;
    const today = todayYmd();
    const idx = Math.round((Date.parse(today) - Date.parse(trip.start_date)) / 86_400_000);
    return {
      members: members.data,
      meId,
      tripStart: trip.start_date,
      dayCount,
      todayIndex: idx >= 0 && idx < dayCount ? idx : null,
      places: (places.data ?? []).map((p) => ({ id: p.id, name: p.name })),
    };
  }, [members.data, meId, trip.start_date, dayCount, places.data]);

  if (expenses.isPending || members.isPending || settlements.isPending) {
    return (
      <div className="p-4" aria-busy>
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (expenses.isError || members.isError || settlements.isError) {
    return (
      <ErrorState
        message={copy.common.loadFailed}
        onRetry={() => {
          void expenses.refetch();
          void members.refetch();
          void settlements.refetch();
        }}
        retryLabel={copy.common.retry}
      />
    );
  }

  const memberName = (id: string) => members.data.find((m) => m.id === id)?.nickname ?? '?';

  return (
    <div className="p-4 pb-28">
      <h1 className="py-2 text-xl font-bold">{copy.routes.expenses}</h1>
      <div
        role="tablist"
        className="mb-3 grid max-w-sm grid-cols-3 gap-1 rounded-full bg-surface p-1 shadow-card"
      >
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setParams(t === 'summary' ? {} : { tab: t }, { replace: true })}
            className={`min-h-11 rounded-full text-sm font-semibold ${tab === t ? 'bg-hero text-white' : 'text-muted'}`}
          >
            {copy.expenses.tabs[t]}
          </button>
        ))}
      </div>

      {tab === 'summary' && (
        <SummaryTab
          expenses={expenses.data}
          settlements={settlements.data}
          members={members.data}
          meId={meId}
          dayCount={dayCount}
          budget={trip.budget_krw === null ? null : Number(trip.budget_krw)}
          onOpen={setDetailId}
        />
      )}
      {tab === 'list' && (
        <ListTab
          expenses={expenses.data}
          members={members.data}
          tripStart={trip.start_date}
          dayCount={dayCount}
          tripTitle={trip.title}
          onOpen={setDetailId}
        />
      )}
      {tab === 'settle' && (
        <SettleTab
          tripId={trip.id}
          expenses={expenses.data}
          settlements={settlements.data}
          members={members.data}
          meId={meId}
        />
      )}

      <button
        type="button"
        className={`${btn.primary} fixed bottom-20 right-4 z-10 shadow-card lg:bottom-6`}
        onClick={() => setFormOpen({})}
        disabled={!ctx}
      >
        <Plus className="size-5" aria-hidden />
        {copy.expenses.add}
      </button>

      <Sheet
        open={!!formOpen}
        onClose={() => setFormOpen(null)}
        title={formOpen?.edit ? copy.expenses.edit : copy.expenses.add}
      >
        {formOpen && ctx && (
          <ExpenseForm
            key={formOpen.edit?.id ?? 'new'}
            ctx={ctx}
            initial={formOpen.edit}
            onSubmit={(input) => {
              save.mutate(input);
              setFormOpen(null);
            }}
          />
        )}
      </Sheet>

      <Sheet open={!!detail} onClose={() => setDetailId(null)} title={detail?.title ?? ''}>
        {detail && (
          <div className="grid gap-3">
            <p className="tabular text-2xl font-extrabold">{formatKrw(Number(detail.amount_krw))}</p>
            {detail.currency !== 'KRW' && (
              <p className="tabular text-sm text-muted">
                {formatMoney(Number(detail.amount), detail.currency)} × {Number(detail.exchange_rate)}
              </p>
            )}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">{copy.expenses.category}</dt>
              <dd>{LABELS_KO[detail.category as ExpenseCategory] ?? detail.category}</dd>
              <dt className="text-muted">{copy.expenses.paymentLabel}</dt>
              <dd>{copy.expenses.payment[detail.payment_method as PaymentMethod]}</dd>
              <dt className="text-muted">{copy.expenses.paidBy}</dt>
              <dd>{memberName(detail.paid_by)}</dd>
              <dt className="text-muted">{copy.plan.day}</dt>
              <dd>
                {detail.day_index === null
                  ? copy.expenses.noDay
                  : formatMdWeekday(dayYmd(trip.start_date, detail.day_index))}
              </dd>
              {detail.place_label && (
                <>
                  <dt className="text-muted">{copy.expenses.place}</dt>
                  <dd>{detail.place_label}</dd>
                </>
              )}
              {detail.memo && (
                <>
                  <dt className="text-muted">{copy.expenses.memo}</dt>
                  <dd>{detail.memo}</dd>
                </>
              )}
            </dl>
            <ul className="divide-y divide-line rounded-input border border-line text-sm">
              {detail.expense_splits.map((s) => (
                <li key={s.member_id} className="flex justify-between px-3 py-2">
                  <span>{memberName(s.member_id)}</span>
                  <span className="tabular">{formatKrw(Number(s.share_krw))}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <button
                type="button"
                className={`${btn.ghost} flex-1`}
                onClick={() => {
                  setFormOpen({ edit: detail });
                  setDetailId(null);
                }}
              >
                {copy.expenses.edit}
              </button>
              <button
                type="button"
                className={`${btn.danger} flex-1`}
                onClick={() => {
                  del.mutate(detail.id);
                  setDetailId(null);
                  toast(copy.expenses.deleted);
                }}
              >
                {copy.plan.menuDelete}
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
