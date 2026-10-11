import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { keys as tripKeys, type Trip } from '@/features/trips/api';
import { RecapResult } from '@/schemas/ai';
import { supabase } from '@/lib/supabase';

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

/** Exactly what get_shared_trip returns: no money, reservations, files, chat, checklist or members. */
export const SharedTrip = z.object({
  title: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  destinations: z.array(
    z.object({
      countryCode: z.string().nullable(),
      city: z.string().nullable(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    }),
  ),
  places: z.array(
    z.object({
      dayIndex: z.number().nullable(),
      startTime: z.string().nullable(),
      endTime: z.string().nullable(),
      name: z.string(),
      category: z.string(),
      address: z.string().nullable(),
      lat: z.number().nullable(),
      lng: z.number().nullable(),
      note: z.string().nullable(),
    }),
  ),
  recap: RecapResult.nullable().catch(null),
});
export type SharedTripData = z.infer<typeof SharedTrip>;

/** `null` for an unknown or disabled link. */
export function useSharedTrip(token: string) {
  return useQuery({
    queryKey: ['shared', token],
    retry: false,
    queryFn: async (): Promise<SharedTripData | null> => {
      const { data, error } = await db().rpc('get_shared_trip', { p_token: token });
      if (error) throw error;
      if (data === null) return null;
      return SharedTrip.parse(data);
    },
  });
}

/** Owner only: turn the read-only link on (new token), off (null) or reissue. */
export function useSetViewLink(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await db().rpc('set_view_link', { p_trip: tripId, p_enabled: enabled });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (token) =>
      qc.setQueryData<Trip | null>(tripKeys.trip(tripId), (t) => (t ? { ...t, view_token: token } : t)),
    onError: () => toast.error(copy.share.ownerOnly),
  });
}

export interface CopyInput {
  title: string;
  start: string;
  nickname: string;
  checklist: boolean;
}

/** My own trip → a new trip (schedule, destinations, optional checklist). */
export function useDuplicateTrip(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: CopyInput) => {
      const { data, error } = await db().rpc('duplicate_trip', {
        p_src: tripId,
        p_title: i.title,
        p_start: i.start,
        p_nickname: i.nickname,
        p_checklist: i.checklist,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.trips }),
  });
}

/** A shared link → my own new trip. */
export function useImportShared(token: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: Omit<CopyInput, 'checklist'>) => {
      const { data, error } = await db().rpc('import_shared_trip', {
        p_view_token: token,
        p_title: i.title,
        p_start: i.start,
        p_nickname: i.nickname,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.trips }),
  });
}
