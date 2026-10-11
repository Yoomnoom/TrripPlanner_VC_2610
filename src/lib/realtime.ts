import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Keeps a cached list of rows (with an `id`) in sync with one table of a trip via Realtime, patching the cache
 * in place (no refetch). UPDATE payloads are merged into the cached row because Realtime omits unchanged
 * TOASTed columns.
 */
export function useRowsRealtime<T extends { id: string }>(
  table: string,
  tripId: string,
  queryKey: readonly unknown[],
  qc: QueryClient,
) {
  const keyString = JSON.stringify(queryKey);
  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    const channel = client
      .channel(`${table}:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table, filter: `trip_id=eq.${tripId}` },
        (p) => {
          qc.setQueryData<T[]>(JSON.parse(keyString), (l) => {
            if (!l) return l;
            if (p.eventType === 'DELETE') return l.filter((r) => r.id !== (p.old as Partial<T>).id);
            const row = p.new as T;
            return l.some((r) => r.id === row.id)
              ? l.map((r) => (r.id === row.id ? { ...r, ...row } : r))
              : [...l, row];
          });
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [table, tripId, keyString, qc]);
}
