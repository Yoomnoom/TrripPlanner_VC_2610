import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { keys as tripKeys } from '@/features/trips/api';
import { useRowsRealtime } from '@/lib/realtime';
import { sortReservations } from '@/lib/reservations';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';

export type Reservation = Database['public']['Tables']['reservations']['Row'];
type Insert = Database['public']['Tables']['reservations']['Insert'];

export const reservationKey = (tripId: string) => ['reservations', tripId] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export function useReservations(tripId: string) {
  const qc = useQueryClient();
  useRowsRealtime<Reservation>('reservations', tripId, reservationKey(tripId), qc);
  return useQuery({
    queryKey: reservationKey(tripId),
    queryFn: async () => {
      const { data, error } = await db().from('reservations').select('*').eq('trip_id', tripId);
      if (error) throw error;
      return data;
    },
    select: (rows) => sortReservations(rows),
  });
}

/** Create or update (same id). Optimistic with rollback toast. */
export function useSaveReservation(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Insert) => {
      const { error } = await db().from('reservations').upsert(row);
      if (error) throw error;
    },
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: reservationKey(tripId) });
      const prev = qc.getQueryData<Reservation[]>(reservationKey(tripId));
      const optimistic = { created_at: new Date().toISOString(), created_by: '', ...row } as Reservation;
      qc.setQueryData<Reservation[]>(
        reservationKey(tripId),
        (l) =>
          l &&
          (l.some((r) => r.id === row.id)
            ? l.map((r) => (r.id === row.id ? { ...r, ...optimistic } : r))
            : [...l, optimistic]),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(reservationKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}

export function useDeleteReservation(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('reservations').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: reservationKey(tripId) });
      const prev = qc.getQueryData<Reservation[]>(reservationKey(tripId));
      qc.setQueryData<Reservation[]>(reservationKey(tripId), (l) => l?.filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(reservationKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}
