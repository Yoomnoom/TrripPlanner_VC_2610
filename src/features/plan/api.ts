import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { createQueue } from '@/lib/queue';
import { supabase } from '@/lib/supabase';
import { getRoutesProvider } from '@/providers/routes';
import type { Database } from '@/types/db';
import type { TravelMode } from '@/types/domain';
import { keys as tripKeys } from '@/features/trips/api';

export type Place = Database['public']['Tables']['places']['Row'];
type PlaceInsert = Database['public']['Tables']['places']['Insert'];
type PlacePatch = Database['public']['Tables']['places']['Update'];

export const placeKeys = { list: (tripId: string) => ['places', tripId] as const };

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export function usePlaces(tripId: string) {
  return useQuery({
    queryKey: placeKeys.list(tripId),
    queryFn: async () => {
      const { data, error } = await db().from('places').select('*').eq('trip_id', tripId);
      if (error) throw error;
      return data;
    },
  });
}

const bumpCounts = (qc: QueryClient, tripId: string) =>
  qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) });

/** Patches the places cache from Realtime events (no refetch). Echoes of my own writes are idempotent upserts. */
export function usePlacesRealtime(tripId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`places:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'places', filter: `trip_id=eq.${tripId}` },
        (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as Partial<Place>).id;
            qc.setQueryData<Place[]>(placeKeys.list(tripId), (l) => l?.filter((x) => x.id !== id));
          } else {
            const row = p.new as Place;
            qc.setQueryData<Place[]>(
              placeKeys.list(tripId),
              (l) =>
                l &&
                (l.some((x) => x.id === row.id) ? l.map((x) => (x.id === row.id ? row : x)) : [...l, row]),
            );
          }
          void bumpCounts(qc, tripId);
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [tripId, qc]);
}

type Snapshot = { prev?: Place[] };

/** Applies `patches` to the cache right away; the caller rolls back via the returned snapshot. */
async function applyOptimistic(
  qc: QueryClient,
  tripId: string,
  patches: { id: string; patch: PlacePatch }[],
): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: placeKeys.list(tripId) });
  const prev = qc.getQueryData<Place[]>(placeKeys.list(tripId));
  const byId = new Map(patches.map((x) => [x.id, x.patch]));
  qc.setQueryData<Place[]>(placeKeys.list(tripId), (l) =>
    l?.map((p) => (byId.has(p.id) ? ({ ...p, ...byId.get(p.id) } as Place) : p)),
  );
  return { prev };
}

/** Batch update (one row per patch). Optimistic; a failure restores the snapshot and shows a toast. */
export function useUpdatePlaces(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patches: { id: string; patch: PlacePatch }[]) => {
      const results = await Promise.all(
        patches.map(({ id, patch }) => db().from('places').update(patch).eq('id', id)),
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onMutate: (patches) => applyOptimistic(qc, tripId, patches),
    onError: (_e, _v, ctx) => {
      qc.setQueryData(placeKeys.list(tripId), (ctx as Snapshot | undefined)?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}

export type NewPlace = Omit<PlaceInsert, 'id' | 'trip_id'>;

export function useAddPlace(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: PlaceInsert) => {
      const { error } = await db().from('places').insert(row);
      if (error) throw error;
    },
    onMutate: async (row) => {
      await qc.cancelQueries({ queryKey: placeKeys.list(tripId) });
      const prev = qc.getQueryData<Place[]>(placeKeys.list(tripId));
      const optimistic = {
        google_place_id: null,
        address: null,
        lat: null,
        lng: null,
        is_indoor: null,
        note: null,
        day_index: null,
        start_time: null,
        end_time: null,
        position: 0,
        category: 'other',
        source: 'manual',
        leg_mode: null,
        leg_duration_s: null,
        leg_distance_m: null,
        leg_polyline: null,
        leg_estimated: false,
        leg_from_place_id: null,
        created_by: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...row,
      } as Place;
      qc.setQueryData<Place[]>(placeKeys.list(tripId), (l) => (l ? [...l, optimistic] : l));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(placeKeys.list(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => bumpCounts(qc, tripId),
  });
}

export function useDeletePlace(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('places').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: placeKeys.list(tripId) });
      const prev = qc.getQueryData<Place[]>(placeKeys.list(tripId));
      qc.setQueryData<Place[]>(placeKeys.list(tripId), (l) => l?.filter((p) => p.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(placeKeys.list(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => bumpCounts(qc, tripId),
  });
}

// ---------------------------------------------------------------- travel legs (SPEC 4-7)

const legQueue = createQueue(3);
const inFlight = new Set<string>();

type LegPlace = Pick<Place, 'id' | 'lat' | 'lng' | 'leg_mode' | 'leg_from_place_id' | 'leg_duration_s'>;

/** The cache is valid when it was computed from this exact previous place in this mode. */
export const legIsFresh = (prev: LegPlace, cur: LegPlace) =>
  cur.leg_from_place_id === prev.id && cur.leg_duration_s !== null && cur.leg_mode !== null;

/**
 * For each adjacent pair in `days` (visible days first) with coordinates on both sides, fills in
 * missing/stale leg_* columns through the RoutesProvider (queue of 3). The estimate is the fallback.
 */
export function useLegCalculation(tripId: string, days: Place[][]) {
  const qc = useQueryClient();
  useEffect(() => {
    const provider = getRoutesProvider();
    for (const day of days) {
      for (let i = 1; i < day.length; i++) {
        const prev = day[i - 1];
        const cur = day[i];
        if (prev.lat === null || prev.lng === null || cur.lat === null || cur.lng === null) continue;
        const mode = (cur.leg_mode ?? 'walk') as TravelMode;
        if (legIsFresh(prev, cur) && cur.leg_mode === mode) continue;
        const key = `${prev.id}>${cur.id}:${mode}`;
        if (inFlight.has(key)) continue;
        inFlight.add(key);
        void legQueue(async () => {
          const leg = await provider.getLeg(
            { lat: prev.lat!, lng: prev.lng! },
            { lat: cur.lat!, lng: cur.lng! },
            mode,
          );
          if (!leg) return;
          const patch: PlacePatch = {
            leg_mode: mode,
            leg_duration_s: leg.durationS,
            leg_distance_m: leg.distanceM,
            leg_polyline: leg.polyline ?? null,
            leg_estimated: leg.estimated,
            leg_from_place_id: prev.id,
          };
          const { error } = await db().from('places').update(patch).eq('id', cur.id);
          if (!error) {
            qc.setQueryData<Place[]>(placeKeys.list(tripId), (l) =>
              l?.map((p) => (p.id === cur.id ? ({ ...p, ...patch } as Place) : p)),
            );
          }
        }).finally(() => inFlight.delete(key));
      }
    }
  }, [days, tripId, qc]);
}

/** Resets the cache so the effect above recomputes (mode change, coordinate edit, time/order change). */
export const invalidLeg: PlacePatch = {
  leg_duration_s: null,
  leg_distance_m: null,
  leg_polyline: null,
  leg_estimated: false,
  leg_from_place_id: null,
};
