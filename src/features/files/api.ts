import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { keys as tripKeys } from '@/features/trips/api';
import { checkUpload, filePath } from '@/lib/files';
import { useRowsRealtime } from '@/lib/realtime';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';

export type TripFile = Database['public']['Tables']['trip_files']['Row'];

export const filesKey = (tripId: string) => ['files', tripId] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export function useFiles(tripId: string) {
  const qc = useQueryClient();
  useRowsRealtime<TripFile>('trip_files', tripId, filesKey(tripId), qc);
  return useQuery({
    queryKey: filesKey(tripId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('trip_files')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Signed URL (valid 1 hour) for a private object. Files are never public. */
export async function signedUrl(
  bucket: 'trip-files' | 'receipts' | 'place-photos',
  path: string,
): Promise<string | null> {
  const { data, error } = await db().storage.from(bucket).createSignedUrl(path, 3600);
  return error ? null : data.signedUrl;
}

export class UploadRejected extends Error {
  constructor(public reason: 'too_large' | 'type' | 'empty') {
    super(reason);
  }
}

/** Uploads to Storage first, then records the row; if the row insert fails the object is removed again. */
export function useUploadFile(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      file,
      title,
      reservationId,
    }: {
      file: File;
      title: string;
      reservationId: string | null;
    }) => {
      const check = checkUpload(file);
      if (!check.ok) throw new UploadRejected(check.reason);
      const id = crypto.randomUUID();
      const path = filePath(tripId, id, file.name);
      const client = db();
      const up = await client.storage
        .from('trip-files')
        .upload(path, file, { contentType: file.type || undefined });
      if (up.error) throw up.error;
      const { data, error } = await client
        .from('trip_files')
        .insert({
          id,
          trip_id: tripId,
          kind: 'file',
          title,
          storage_path: path,
          mime_type: file.type || null,
          size_bytes: file.size,
          reservation_id: reservationId,
        })
        .select('*')
        .single();
      if (error) {
        await client.storage.from('trip-files').remove([path]);
        throw error;
      }
      return data;
    },
    onSuccess: (row) => {
      qc.setQueryData<TripFile[]>(filesKey(tripId), (l) =>
        l && !l.some((f) => f.id === row.id) ? [row, ...l] : l,
      );
      void qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) });
    },
    onError: (e) => {
      if (e instanceof UploadRejected) {
        toast.error(
          e.reason === 'too_large'
            ? copy.files.tooLarge
            : e.reason === 'type'
              ? copy.files.badType
              : copy.files.empty0,
        );
      } else toast.error(copy.files.uploadFailed);
    },
  });
}

export function useAddLink(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      title,
      url,
      reservationId,
    }: {
      title: string;
      url: string;
      reservationId: string | null;
    }) => {
      const { data, error } = await db()
        .from('trip_files')
        .insert({
          id: crypto.randomUUID(),
          trip_id: tripId,
          kind: 'link',
          title,
          url,
          reservation_id: reservationId,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (row) => {
      qc.setQueryData<TripFile[]>(filesKey(tripId), (l) =>
        l && !l.some((f) => f.id === row.id) ? [row, ...l] : l,
      );
      void qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) });
    },
    onError: () => toast.error(copy.common.saveFailed),
  });
}

export function useUpdateFile(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: { title?: string; reservation_id?: string | null };
    }) => {
      const { error } = await db().from('trip_files').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: filesKey(tripId) });
      const prev = qc.getQueryData<TripFile[]>(filesKey(tripId));
      qc.setQueryData<TripFile[]>(filesKey(tripId), (l) =>
        l?.map((f) => (f.id === id ? { ...f, ...patch } : f)),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(filesKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
  });
}

export function useDeleteFile(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: TripFile) => {
      const client = db();
      const { error } = await client.from('trip_files').delete().eq('id', file.id);
      if (error) throw error;
      if (file.storage_path) await client.storage.from('trip-files').remove([file.storage_path]); // best effort
    },
    onMutate: async (file) => {
      await qc.cancelQueries({ queryKey: filesKey(tripId) });
      const prev = qc.getQueryData<TripFile[]>(filesKey(tripId));
      qc.setQueryData<TripFile[]>(filesKey(tripId), (l) => l?.filter((f) => f.id !== file.id));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      qc.setQueryData(filesKey(tripId), ctx?.prev);
      toast.error(copy.common.saveFailed);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) }),
  });
}
