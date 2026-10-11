import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { useRowsRealtime } from '@/lib/realtime';
import { resizeToJpeg } from '@/lib/image';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';

export type Review = Database['public']['Tables']['place_reviews']['Row'];
export type PlacePhoto = Database['public']['Tables']['place_photos']['Row'];

export const MAX_PHOTOS = 5;

export const reviewsKey = (tripId: string) => ['reviews', tripId] as const;
export const photosKey = (tripId: string) => ['photos', tripId] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export function useReviews(tripId: string) {
  const qc = useQueryClient();
  useRowsRealtime<Review>('place_reviews', tripId, reviewsKey(tripId), qc);
  return useQuery({
    queryKey: reviewsKey(tripId),
    queryFn: async () => {
      const { data, error } = await db().from('place_reviews').select('*').eq('trip_id', tripId);
      if (error) throw error;
      return data;
    },
  });
}

export function usePhotos(tripId: string) {
  const qc = useQueryClient();
  useRowsRealtime<PlacePhoto>('place_photos', tripId, photosKey(tripId), qc);
  return useQuery({
    queryKey: photosKey(tripId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('place_photos')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

/** One review per member and place (upsert on place_id + member_id); optimistic with a rollback toast. */
export function useSaveReview(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: { placeId: string; memberId: string; rating: number; comment: string | null }) => {
      const { error } = await db().from('place_reviews').upsert(
        {
          trip_id: tripId,
          place_id: r.placeId,
          member_id: r.memberId,
          rating: r.rating,
          comment: r.comment,
        },
        { onConflict: 'place_id,member_id' },
      );
      if (error) throw error;
    },
    onMutate: async (r) => {
      await qc.cancelQueries({ queryKey: reviewsKey(tripId) });
      const prev = qc.getQueryData<Review[]>(reviewsKey(tripId));
      qc.setQueryData<Review[]>(reviewsKey(tripId), (l) => {
        if (!l) return l;
        const hit = l.find((x) => x.place_id === r.placeId && x.member_id === r.memberId);
        const next = { rating: r.rating, comment: r.comment };
        return hit
          ? l.map((x) => (x === hit ? { ...x, ...next } : x))
          : [
              ...l,
              {
                id: `tmp-${r.placeId}-${r.memberId}`,
                trip_id: tripId,
                place_id: r.placeId,
                member_id: r.memberId,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...next,
              } as Review,
            ];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(reviewsKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: reviewsKey(tripId) }),
  });
}

export function useDeleteReview(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db().from('place_reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: reviewsKey(tripId) });
      const prev = qc.getQueryData<Review[]>(reviewsKey(tripId));
      qc.setQueryData<Review[]>(reviewsKey(tripId), (l) => l?.filter((r) => r.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(reviewsKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}

/** Resize to 1600px JPEG, upload to the private place-photos bucket, then record the row (removed again on failure). */
export function useUploadPhoto(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ placeId, file }: { placeId: string; file: File }) => {
      const client = db();
      const blob = await resizeToJpeg(file);
      const path = `${tripId}/${crypto.randomUUID()}.jpg`;
      const up = await client.storage.from('place-photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (up.error) throw up.error;
      const { data, error } = await client
        .from('place_photos')
        .insert({ trip_id: tripId, place_id: placeId, storage_path: path })
        .select('*')
        .single();
      if (error) {
        await client.storage.from('place-photos').remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: (row) =>
      qc.setQueryData<PlacePhoto[]>(photosKey(tripId), (l) =>
        l && !l.some((p) => p.id === row.id) ? [...l, row] : l,
      ),
    onError: () => toast.error(copy.reviews.photoFailed),
  });
}

export function useDeletePhoto(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: PlacePhoto) => {
      const client = db();
      const { error } = await client.from('place_photos').delete().eq('id', p.id);
      if (error) throw error;
      await client.storage.from('place-photos').remove([p.storage_path]); // best effort
    },
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: photosKey(tripId) });
      const prev = qc.getQueryData<PlacePhoto[]>(photosKey(tripId));
      qc.setQueryData<PlacePhoto[]>(photosKey(tripId), (l) => l?.filter((x) => x.id !== p.id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(photosKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}

/** Signed URL for a stored photo (1 hour), cached per path for the session. */
export function usePhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ['photo-url', path],
    enabled: !!path,
    staleTime: 50 * 60_000,
    queryFn: async () => {
      const { data, error } = await db().storage.from('place-photos').createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
