import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { savedKey } from '@/lib/saved';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';

export type SavedPlace = Database['public']['Tables']['saved_places']['Row'];

export const savedQueryKey = ['saved-places'] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

/** "내 저장": personal data, RLS returns only my rows (independent of any trip). */
export function useSavedPlaces() {
  return useQuery({
    queryKey: savedQueryKey,
    queryFn: async () => {
      const { data, error } = await db()
        .from('saved_places')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export interface SaveInput {
  google_place_id?: string | null;
  name: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  category: string;
  country_code?: string | null;
  city?: string | null;
}

export function useSavePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: SaveInput) => {
      const uid = (await db().auth.getUser()).data.user?.id;
      if (!uid) throw new Error('NO_SESSION');
      const { error } = await db()
        .from('saved_places')
        .upsert(
          {
            user_id: uid,
            google_place_id: savedKey(p),
            name: p.name,
            address: p.address ?? null,
            lat: p.lat ?? null,
            lng: p.lng ?? null,
            category: p.category,
            country_code: p.country_code ?? null,
            city: p.city ?? null,
          },
          { onConflict: 'user_id,google_place_id', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: savedQueryKey });
      toast.success(copy.saved.saved);
    },
    onError: () => toast.error(copy.common.saveFailed),
  });
}

export function useUnsavePlace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('saved_places').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: savedQueryKey });
      const prev = qc.getQueryData<SavedPlace[]>(savedQueryKey);
      qc.setQueryData<SavedPlace[]>(savedQueryKey, (l) => l?.filter((s) => s.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(savedQueryKey, ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}

export function useUpdateSavedMemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, memo }: { id: string; memo: string | null }) => {
      const { error } = await db().from('saved_places').update({ memo }).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, memo }) => {
      await qc.cancelQueries({ queryKey: savedQueryKey });
      const prev = qc.getQueryData<SavedPlace[]>(savedQueryKey);
      qc.setQueryData<SavedPlace[]>(savedQueryKey, (l) => l?.map((s) => (s.id === id ? { ...s, memo } : s)));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(savedQueryKey, ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}
