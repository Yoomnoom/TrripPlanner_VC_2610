import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';
import { copy } from '@/copy';

export type Trip = Database['public']['Tables']['trips']['Row'];
export type Member = Database['public']['Tables']['members']['Row'];

export const keys = {
  trips: ['trips'] as const,
  trip: (id: string) => ['trip', id] as const,
  members: (tripId: string) => ['members', tripId] as const,
  counts: (tripId: string) => ['counts', tripId] as const,
};

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

/** Postgres/PostgREST error → app-level reason. */
export type TripErrorCode = 'invalid_invite' | 'forbidden' | 'has_records' | 'duplicate_nickname' | 'unknown';
export function errorCode(e: unknown): TripErrorCode {
  const { message = '', code = '' } = (e ?? {}) as { message?: string; code?: string };
  if (message.includes('invalid or disabled invite')) return 'invalid_invite';
  if (message.includes('forbidden') || code === '42501') return 'forbidden';
  if (code === '23503') return 'has_records';
  if (code === '23505') return 'duplicate_nickname';
  return 'unknown';
}

// ---------------------------------------------------------------- queries

export function useMyTrips() {
  return useQuery({
    queryKey: keys.trips,
    queryFn: async () => {
      const { data, error } = await db()
        .from('trips')
        .select('*, members(count)')
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data.map(({ members, ...trip }) => ({
        trip: trip as Trip,
        memberCount: members[0]?.count ?? 0,
      }));
    },
  });
}

export function useTrip(tripId: string) {
  return useQuery({
    queryKey: keys.trip(tripId),
    queryFn: async () => {
      const { data, error } = await db().from('trips').select('*').eq('id', tripId).maybeSingle();
      if (error) throw error;
      return data; // null → not a member or deleted
    },
  });
}

export function useMembers(tripId: string) {
  return useQuery({
    queryKey: keys.members(tripId),
    queryFn: async () => {
      const { data, error } = await db().from('members').select('*').eq('trip_id', tripId).order('joined_at');
      if (error) throw error;
      return data;
    },
  });
}

export type TripCounts = {
  places: number;
  reservations: number;
  files: number;
  expenses: number;
  checklistTotal: number;
  checklistDone: number;
};

export function useTripCounts(tripId: string) {
  return useQuery({
    queryKey: keys.counts(tripId),
    queryFn: async (): Promise<TripCounts> => {
      const client = db();
      const head = (t: 'places' | 'reservations' | 'trip_files' | 'expenses' | 'checklist_items') =>
        client.from(t).select('id', { count: 'exact', head: true }).eq('trip_id', tripId);
      const results = await Promise.all([
        head('places'),
        head('reservations'),
        head('trip_files'),
        head('expenses'),
        head('checklist_items'),
        client
          .from('checklist_items')
          .select('id', { count: 'exact', head: true })
          .eq('trip_id', tripId)
          .eq('checked', true),
      ]);
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
      const [places, reservations, files, expenses, total, done] = results.map((r) => r.count ?? 0);
      return { places, reservations, files, expenses, checklistTotal: total, checklistDone: done };
    },
  });
}

const InviteSchema = z.array(
  z.object({ title: z.string(), start_date: z.string(), end_date: z.string(), member_count: z.number() }),
);
export type InvitePreview = z.infer<typeof InviteSchema>[number];

/** Returns null for an unknown or disabled token. */
export async function peekInvite(token: string): Promise<InvitePreview | null> {
  const { data, error } = await db().rpc('peek_invite', { p_token: token });
  if (error) throw error;
  return InviteSchema.parse(data)[0] ?? null;
}

// ---------------------------------------------------------------- realtime → cache patches (no refetch)

function upsertById<T extends { id: string }>(list: T[] | undefined, row: T): T[] | undefined {
  if (!list) return list;
  return list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : [...list, row];
}

/** Subscribes to this trip's trips/members rows and patches the Query cache in place. */
export function useTripRealtime(tripId: string, qc: QueryClient) {
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `trip_id=eq.${tripId}` },
        (p) => {
          if (p.eventType === 'DELETE') {
            const id = (p.old as Partial<Member>).id;
            qc.setQueryData<Member[]>(keys.members(tripId), (l) => l?.filter((m) => m.id !== id));
          } else {
            const row = p.new as Member;
            qc.setQueryData<Member[]>(keys.members(tripId), (l) => upsertById(l, row));
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
        (p) => {
          qc.setQueryData<Trip | null>(keys.trip(tripId), p.new as Trip);
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [tripId, qc]);
}

// ---------------------------------------------------------------- mutations

export type CreateTripInput = {
  title: string;
  start: string;
  end: string;
  nickname: string;
  destination?: { country_code: string; city: string | null };
  headcount?: number;
  budgetKrw?: number;
};

export function useCreateTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripInput) => {
      const client = db();
      const { data: id, error } = await client.rpc('create_trip', {
        p_title: input.title,
        p_start: input.start,
        p_end: input.end,
        p_nickname: input.nickname,
        p_destinations: input.destination ? [input.destination] : [],
      });
      if (error) throw error;
      // headcount/budget are optional extras; a failure here must not lose the created trip.
      if (input.headcount !== undefined || input.budgetKrw !== undefined) {
        await client
          .from('trips')
          .update({ headcount: input.headcount ?? null, budget_krw: input.budgetKrw ?? null })
          .eq('id', id);
      }
      const { data: trip } = await client.from('trips').select('invite_token').eq('id', id).maybeSingle();
      return { id, inviteToken: trip?.invite_token ?? null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.trips }),
  });
}

export function useJoinTrip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ token, nickname }: { token: string; nickname: string }) => {
      const { data, error } = await db().rpc('join_trip', { p_token: token, p_nickname: nickname });
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.trips }),
  });
}

/** Turn sharing on (new token) or off (null). Owner only; existing members are kept. */
export function useSetInvite(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (enabled: boolean) => {
      const { data, error } = await db().rpc('set_invite', { p_trip: tripId, p_enabled: enabled });
      if (error) throw error;
      return data as string | null;
    },
    onSuccess: (token) => {
      qc.setQueryData<Trip | null>(keys.trip(tripId), (t) => (t ? { ...t, invite_token: token } : t));
    },
    onError: (e) =>
      toast.error(errorCode(e) === 'forbidden' ? copy.members.ownerOnly : copy.common.saveFailed),
  });
}

/** Optimistic edit of my own nickname/color; rolls back with a toast on failure. */
export function useUpdateMyMember(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<Member, 'nickname' | 'color'>> }) => {
      const { error } = await db().from('members').update(patch).eq('id', id);
      if (error) throw error;
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.members(tripId) });
      const prev = qc.getQueryData<Member[]>(keys.members(tripId));
      qc.setQueryData<Member[]>(keys.members(tripId), (l) =>
        l?.map((m) => (m.id === id ? { ...m, ...patch } : m)),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.members(tripId), ctx?.prev);
      toast.error(
        errorCode(e) === 'duplicate_nickname' ? copy.members.nicknameTaken : copy.common.saveFailed,
      );
    },
  });
}

/** Owner removes a member. Members with expense/settlement records are rejected by the DB (FK). */
export function useRemoveMember(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await db().from('members').delete().eq('id', id).select('id');
      if (error) throw error;
      if (data.length === 0) throw Object.assign(new Error('forbidden'), { code: '42501' });
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.members(tripId) });
      const prev = qc.getQueryData<Member[]>(keys.members(tripId));
      qc.setQueryData<Member[]>(keys.members(tripId), (l) => l?.filter((m) => m.id !== id));
      return { prev };
    },
    onError: (e, _v, ctx) => {
      qc.setQueryData(keys.members(tripId), ctx?.prev);
      toast.error(errorCode(e) === 'has_records' ? copy.members.hasRecords : copy.common.saveFailed);
    },
  });
}
