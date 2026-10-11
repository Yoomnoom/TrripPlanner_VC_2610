import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { keys as tripKeys, useMembers } from '@/features/trips/api';
import { supabase } from '@/lib/supabase';
import { writeOrQueue } from '@/lib/offlineStore';
import type { Database } from '@/types/db';

export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];
type Insert = Database['public']['Tables']['checklist_items']['Insert'];
type Patch = Database['public']['Tables']['checklist_items']['Update'];

export const checklistKey = (tripId: string) => ['checklist', tripId] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export function useChecklist(tripId: string) {
  return useQuery({
    queryKey: checklistKey(tripId),
    queryFn: async () => {
      const { data, error } = await db().from('checklist_items').select('*').eq('trip_id', tripId);
      if (error) throw error;
      return data;
    },
  });
}

/** The current user's member row (its id is what `checked_by` stores). */
export function useMyMemberId(tripId: string, userId: string) {
  return useMembers(tripId).data?.find((m) => m.user_id === userId)?.id ?? null;
}

/** Realtime → cache patches for the checklist (no refetch). Mounted once per trip in TripLayout. */
export function useChecklistRealtime(tripId: string, qc: QueryClient) {
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`checklist:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'checklist_items', filter: `trip_id=eq.${tripId}` },
        (p) => {
          qc.setQueryData<ChecklistItem[]>(checklistKey(tripId), (l) => {
            if (!l) return l;
            if (p.eventType === 'DELETE')
              return l.filter((x) => x.id !== (p.old as Partial<ChecklistItem>).id);
            const row = p.new as ChecklistItem;
            return l.some((x) => x.id === row.id) ? l.map((x) => (x.id === row.id ? row : x)) : [...l, row];
          });
          void qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) });
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [tripId, qc]);
}

type Snap = { prev?: ChecklistItem[] };

async function optimistic(
  qc: QueryClient,
  tripId: string,
  fn: (l: ChecklistItem[]) => ChecklistItem[],
): Promise<Snap> {
  await qc.cancelQueries({ queryKey: checklistKey(tripId) });
  const prev = qc.getQueryData<ChecklistItem[]>(checklistKey(tripId));
  qc.setQueryData<ChecklistItem[]>(checklistKey(tripId), (l) => (l ? fn(l) : l));
  return { prev };
}

function useRollback(tripId: string) {
  const qc = useQueryClient();
  return (_e: unknown, _v: unknown, ctx: Snap | undefined) => {
    qc.setQueryData(checklistKey(tripId), ctx?.prev);
    toast.error(copy.common.saveFailed);
  };
}

export function useAddItems(tripId: string) {
  const qc = useQueryClient();
  const rollback = useRollback(tripId);
  return useMutation({
    mutationFn: async (rows: Insert[]) => {
      const { error } = await db().from('checklist_items').insert(rows);
      if (error) throw error;
    },
    onMutate: (rows) =>
      optimistic(qc, tripId, (l) => [
        ...l,
        ...rows.map(
          (r) =>
            ({
              checked: false,
              checked_by: null,
              created_at: new Date().toISOString(),
              position: 0,
              ...r,
            }) as ChecklistItem,
        ),
      ]),
    onError: rollback,
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}

export function useUpdateItems(tripId: string) {
  const qc = useQueryClient();
  const rollback = useRollback(tripId);
  return useMutation({
    mutationFn: async (patches: { id: string; patch: Patch }[]) => {
      await Promise.all(
        patches.map(async ({ id, patch }) => {
          const run = async () => {
            const { error } = await db().from('checklist_items').update(patch).eq('id', id);
            if (error) throw error;
          };
          // Toggling a checkbox may wait for the connection; renames and reordering may not (SPEC F-3-4).
          const keys = Object.keys(patch);
          const queueable = keys.length > 0 && keys.every((k) => k === 'checked' || k === 'checked_by');
          if (!queueable) return run();
          await writeOrQueue(
            tripId,
            {
              type: 'checklist.update',
              id,
              patch: patch as { checked?: boolean; checked_by?: string | null },
            },
            run,
          );
        }),
      );
    },
    onMutate: (patches) => {
      const by = new Map(patches.map((x) => [x.id, x.patch]));
      return optimistic(qc, tripId, (l) =>
        l.map((i) => (by.has(i.id) ? ({ ...i, ...by.get(i.id) } as ChecklistItem) : i)),
      );
    },
    onError: rollback,
  });
}

export function useDeleteItem(tripId: string) {
  const qc = useQueryClient();
  const rollback = useRollback(tripId);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('checklist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) => optimistic(qc, tripId, (l) => l.filter((i) => i.id !== id)),
    onError: rollback,
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}
