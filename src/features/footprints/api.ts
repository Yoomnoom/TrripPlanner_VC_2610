import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';
import type { PastTripInput } from './stats';

export type Footprint = Database['public']['Tables']['footprints']['Row'];
export type FootprintKind = 'country' | 'region';
export type FootprintStatus = 'visited' | 'wish';

export const footprintKey = ['footprints'] as const;
export const myTripsDetailKey = ['footprint-trips'] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

/** Footprints are personal: RLS returns only my rows. */
export function useFootprints() {
  return useQuery({
    queryKey: footprintKey,
    queryFn: async () => {
      const { data, error } = await db().from('footprints').select('*').order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export interface TripSummary extends PastTripInput {
  id: string;
  title: string;
  countryCodes: string[];
}

/** My trips with what the stats need: destinations (cities/countries) and how many places are scheduled. */
export function useTripSummaries() {
  return useQuery({
    queryKey: myTripsDetailKey,
    queryFn: async (): Promise<TripSummary[]> => {
      const { data, error } = await db()
        .from('trips')
        .select('id, title, start_date, end_date, trip_destinations(city, country_code), places(day_index)');
      if (error) throw error;
      return data.map((t) => ({
        id: t.id,
        title: t.title,
        startDate: t.start_date,
        endDate: t.end_date,
        placeCount: t.places.filter((p) => p.day_index !== null).length,
        cities: t.trip_destinations.map((d) => d.city ?? '').filter(Boolean),
        countryCodes: t.trip_destinations.map((d) => d.country_code),
      }));
    },
  });
}

export interface FootprintInput {
  kind: FootprintKind;
  code: string;
  status: FootprintStatus;
  period?: string | null;
  memo?: string | null;
}

/** Create or update my footprint for (kind, code). Optimistic with rollback toast. */
export function useSetFootprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FootprintInput) => {
      const uid = (await db().auth.getUser()).data.user?.id;
      if (!uid) throw new Error('NO_SESSION');
      const { error } = await db()
        .from('footprints')
        .upsert(
          {
            user_id: uid,
            kind: input.kind,
            code: input.code,
            status: input.status,
            period: input.period ?? null,
            memo: input.memo ?? null,
          },
          { onConflict: 'user_id,kind,code' },
        );
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: footprintKey });
      const prev = qc.getQueryData<Footprint[]>(footprintKey);
      qc.setQueryData<Footprint[]>(footprintKey, (l) => {
        if (!l) return l;
        const hit = l.find((f) => f.kind === input.kind && f.code === input.code);
        const next = { status: input.status, period: input.period ?? null, memo: input.memo ?? null };
        return hit
          ? l.map((f) => (f === hit ? { ...f, ...next } : f))
          : [
              ...l,
              {
                id: `tmp-${input.kind}-${input.code}`,
                user_id: '',
                kind: input.kind,
                code: input.code,
                trip_id: null,
                created_at: new Date().toISOString(),
                ...next,
              } as Footprint,
            ];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(footprintKey, ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    // the temporary id is replaced by the real row
    onSettled: () => qc.invalidateQueries({ queryKey: footprintKey }),
  });
}

export function useRemoveFootprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (f: Pick<Footprint, 'kind' | 'code'>) => {
      const { error } = await db().from('footprints').delete().eq('kind', f.kind).eq('code', f.code);
      if (error) throw error;
    },
    onMutate: async (f) => {
      await qc.cancelQueries({ queryKey: footprintKey });
      const prev = qc.getQueryData<Footprint[]>(footprintKey);
      qc.setQueryData<Footprint[]>(footprintKey, (l) =>
        l?.filter((x) => !(x.kind === f.kind && x.code === f.code)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(footprintKey, ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}
