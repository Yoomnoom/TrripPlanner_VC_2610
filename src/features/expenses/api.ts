import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { keys as tripKeys } from '@/features/trips/api';
import type { ExpenseRow, SplitRow } from '@/lib/expenseStats';
import { supabase } from '@/lib/supabase';
import { writeOrQueue } from '@/lib/offlineStore';
import type { Database } from '@/types/db';

type Tables = Database['public']['Tables'];
export type Expense = Tables['expenses']['Row'];
export type Split = Tables['expense_splits']['Row'];
export type Settlement = Tables['settlements']['Row'];
export type ExpenseWithSplits = Expense & { expense_splits: Split[] };

export const expenseKeys = {
  list: (tripId: string) => ['expenses', tripId] as const,
  settlements: (tripId: string) => ['settlements', tripId] as const,
};

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export function useExpenses(tripId: string) {
  return useQuery({
    queryKey: expenseKeys.list(tripId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('expenses')
        .select('*, expense_splits(*)')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ExpenseWithSplits[];
    },
  });
}

export function useSettlements(tripId: string) {
  return useQuery({
    queryKey: expenseKeys.settlements(tripId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('settlements')
        .select('*')
        .eq('trip_id', tripId)
        .order('settled_at');
      if (error) throw error;
      return data;
    },
  });
}

/** Flat rows for the pure stats / settlement functions. */
export function toRows(list: readonly ExpenseWithSplits[]): { expenses: ExpenseRow[]; splits: SplitRow[] } {
  return {
    expenses: list.map((e) => ({
      id: e.id,
      category: e.category,
      amountKrw: Number(e.amount_krw),
      dayIndex: e.day_index,
      paidBy: e.paid_by,
    })),
    splits: list.flatMap((e) =>
      e.expense_splits.map((s) => ({
        expenseId: s.expense_id,
        memberId: s.member_id,
        shareKrw: Number(s.share_krw),
      })),
    ),
  };
}

/**
 * Realtime: expenses carry trip_id, so we listen on them and fetch only the affected expense's splits
 * (no full refetch). Settlements are patched directly. Mounted once per trip in TripLayout.
 */
export function useExpensesRealtime(tripId: string, qc: QueryClient) {
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`expenses:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
        (p) => {
          void qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) });
          if (p.eventType === 'DELETE') {
            const id = (p.old as Partial<Expense>).id;
            qc.setQueryData<ExpenseWithSplits[]>(expenseKeys.list(tripId), (l) =>
              l?.filter((e) => e.id !== id),
            );
            return;
          }
          const row = p.new as Expense;
          void client
            .from('expense_splits')
            .select('*')
            .eq('expense_id', row.id)
            .then(({ data }) => {
              const next = { ...row, expense_splits: data ?? [] };
              qc.setQueryData<ExpenseWithSplits[]>(
                expenseKeys.list(tripId),
                (l) =>
                  l &&
                  (l.some((e) => e.id === row.id)
                    ? l.map((e) => (e.id === row.id ? next : e))
                    : [next, ...l]),
              );
            });
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settlements', filter: `trip_id=eq.${tripId}` },
        (p) => {
          qc.setQueryData<Settlement[]>(expenseKeys.settlements(tripId), (l) => {
            if (!l) return l;
            if (p.eventType === 'DELETE') return l.filter((s) => s.id !== (p.old as Partial<Settlement>).id);
            const row = p.new as Settlement;
            return l.some((s) => s.id === row.id) ? l.map((s) => (s.id === row.id ? row : s)) : [...l, row];
          });
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [tripId, qc]);
}

export interface ExpenseInput {
  id: string;
  day_index: number | null;
  spent_on: string | null;
  title: string;
  category: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  amount_krw: number;
  payment_method: string;
  paid_by: string;
  place_id: string | null;
  place_label: string | null;
  memo: string | null;
  receipt_path: string | null;
  splits: { member_id: string; share_krw: number }[];
}

/** Expenses are written ONLY through the save_expense RPC (no direct insert/update permission). */
export function useSaveExpense(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ splits, ...data }: ExpenseInput) => {
      const run = async () => {
        const { error } = await db().rpc('save_expense', {
          p_trip: tripId,
          p_id: data.id,
          p_data: data,
          p_splits: splits,
        });
        if (error) throw error;
      };
      // Adding an expense offline is allowed (receipt attachments are not: they need the network).
      if (data.receipt_path) return run();
      await writeOrQueue(tripId, { type: 'expense.save', tripId, id: data.id, data, splits }, run);
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: expenseKeys.list(tripId) });
      const prev = qc.getQueryData<ExpenseWithSplits[]>(expenseKeys.list(tripId));
      const { splits, ...rest } = input;
      const optimistic = {
        ...rest,
        trip_id: tripId,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expense_splits: splits.map((s) => ({ expense_id: input.id, ...s })),
      } as unknown as ExpenseWithSplits;
      qc.setQueryData<ExpenseWithSplits[]>(
        expenseKeys.list(tripId),
        (l) =>
          l &&
          (l.some((e) => e.id === input.id)
            ? l.map((e) => (e.id === input.id ? optimistic : e))
            : [optimistic, ...l]),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(expenseKeys.list(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}

export function useDeleteExpense(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: expenseKeys.list(tripId) });
      const prev = qc.getQueryData<ExpenseWithSplits[]>(expenseKeys.list(tripId));
      qc.setQueryData<ExpenseWithSplits[]>(expenseKeys.list(tripId), (l) => l?.filter((e) => e.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(expenseKeys.list(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}

/** Records that `from` paid `to` (settlement). Optimistic; rolls back with a toast on failure. */
export function useAddSettlement(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: { id: string; from_member: string; to_member: string; amount_krw: number }) => {
      const { error } = await db()
        .from('settlements')
        .insert({ ...row, trip_id: tripId });
      if (error) throw error;
    },
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: expenseKeys.settlements(tripId) });
      const prev = qc.getQueryData<Settlement[]>(expenseKeys.settlements(tripId));
      const optimistic = {
        ...row,
        trip_id: tripId,
        settled_at: new Date().toISOString(),
        created_by: '',
      } as Settlement;
      qc.setQueryData<Settlement[]>(expenseKeys.settlements(tripId), (l) => (l ? [...l, optimistic] : l));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(expenseKeys.settlements(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}

/** Undo a settlement. */
export function useDeleteSettlement(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('settlements').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: expenseKeys.settlements(tripId) });
      const prev = qc.getQueryData<Settlement[]>(expenseKeys.settlements(tripId));
      qc.setQueryData<Settlement[]>(expenseKeys.settlements(tripId), (l) => l?.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(expenseKeys.settlements(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}
