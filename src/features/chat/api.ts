import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { copy } from '@/copy';
import { placeKeys, type Place } from '@/features/plan/api';
import { keys as tripKeys, type Trip } from '@/features/trips/api';
import { asProposal, proposalToRows, type Proposal } from '@/lib/itinerary';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/db';

export type ChatMessage = Database['public']['Tables']['chat_messages']['Row'];

export const chatKey = (tripId: string) => ['chat', tripId] as const;

function db() {
  if (!supabase) throw new Error('ENV_MISSING');
  return supabase;
}

export type AiErrorCode = 'AI_NO_KEY' | 'AI_FAILED' | 'LIMIT_REACHED' | 'FORBIDDEN' | 'UNKNOWN';

/** Edge Function errors arrive as FunctionsHttpError with the Response in `context`. */
export async function functionErrorCode(e: unknown): Promise<AiErrorCode> {
  try {
    const res = (e as { context?: Response }).context;
    const code = (await res?.json())?.error?.code as string | undefined;
    if (code === 'AI_NO_KEY' || code === 'AI_FAILED' || code === 'LIMIT_REACHED' || code === 'FORBIDDEN')
      return code;
  } catch {
    // body was not JSON: treat as unknown
  }
  return 'UNKNOWN';
}

export function aiErrorMessage(code: AiErrorCode) {
  return code === 'AI_NO_KEY'
    ? copy.chat.needKey
    : code === 'LIMIT_REACHED'
      ? copy.chat.limit
      : code === 'AI_FAILED'
        ? copy.chat.failed
        : copy.chat.unknown;
}

export function useChatMessages(tripId: string) {
  return useQuery({
    queryKey: chatKey(tripId),
    queryFn: async () => {
      const { data, error } = await db()
        .from('chat_messages')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Everyone in the trip sees the same conversation: new rows are appended to the cache as they arrive. */
export function useChatRealtime(tripId: string, qc: QueryClient) {
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel(`chat:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `trip_id=eq.${tripId}` },
        (p) => {
          qc.setQueryData<ChatMessage[]>(chatKey(tripId), (l) => {
            if (!l) return l;
            if (p.eventType === 'DELETE') return l.filter((m) => m.id !== (p.old as Partial<ChatMessage>).id);
            const row = p.new as ChatMessage;
            // Merge, don't replace: Realtime omits unchanged TOASTed columns (e.g. a large `proposal` jsonb) on UPDATE.
            return l.some((m) => m.id === row.id)
              ? l.map((m) => (m.id === row.id ? { ...m, ...row } : m))
              : [...l, row];
          });
        },
      )
      .subscribe();
    return () => {
      void supabase?.removeChannel(channel);
    };
  }, [tripId, qc]);
}

export interface AiStatus {
  gemini: boolean;
  openrouter: boolean;
  fake: boolean;
  models: { gemini: string; openrouter: string };
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    staleTime: 60_000,
    queryFn: async (): Promise<AiStatus> => {
      const { data, error } = await db().functions.invoke('ai-status', { body: {} });
      if (error) throw error;
      return (data as { data: AiStatus }).data;
    },
  });
}

export interface ConnectionTest {
  ok: boolean;
  provider?: string;
  model?: string;
  code?: string;
  message?: string;
}

export async function testConnection(provider: 'gemini' | 'openrouter'): Promise<ConnectionTest> {
  const { data, error } = await db().functions.invoke('ai-status', { body: { test: provider } });
  if (error) return { ok: false, code: await functionErrorCode(error) };
  return (data as { data: { test: ConnectionTest } }).data.test;
}

export function useSendMessage(tripId: string) {
  return useMutation({
    mutationFn: async (message: string) => {
      const { error } = await db().functions.invoke('ai-plan', { body: { tripId, message } });
      if (error) throw error;
    },
    onError: async (e) => {
      toast.error(aiErrorMessage(await functionErrorCode(e)));
    },
  });
}

/**
 * Applies a proposal to the schedule. "overwrite" removes the current day places first (the idea inbox is kept);
 * "append" adds after what is there. The places cache is patched from the returned rows (no refetch).
 */
export function useApplyProposal(tripId: string, dayCount: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ message, mode }: { message: ChatMessage; mode: 'overwrite' | 'append' }) => {
      const proposal = asProposal(message.proposal);
      if (!proposal) throw new Error('INVALID_PROPOSAL');
      const client = db();
      const cached = qc.getQueryData<Place[]>(placeKeys.list(tripId)) ?? [];
      let removedIds: string[] = [];
      const last: Record<number, number> = {};
      if (mode === 'overwrite') {
        removedIds = cached.filter((p) => p.day_index !== null).map((p) => p.id);
        const { error } = await client
          .from('places')
          .delete()
          .eq('trip_id', tripId)
          .not('day_index', 'is', null);
        if (error) throw error;
      } else {
        for (const p of cached)
          if (p.day_index !== null) last[p.day_index] = Math.max(last[p.day_index] ?? 0, p.position);
      }
      const rows = proposalToRows(proposal as Proposal, tripId, dayCount, mode === 'append' ? last : {});
      const { data, error } = await client.from('places').insert(rows).select('*');
      if (error) throw error;
      const { error: markErr } = await client
        .from('chat_messages')
        .update({ proposal_applied: true })
        .eq('id', message.id);
      if (markErr) throw markErr;
      return { removedIds, inserted: data as Place[] };
    },
    onSuccess: ({ removedIds, inserted }, { message }) => {
      qc.setQueryData<Place[]>(placeKeys.list(tripId), (l) => {
        if (!l) return l;
        const gone = new Set(removedIds);
        const have = new Set(l.map((p) => p.id));
        return [...l.filter((p) => !gone.has(p.id)), ...inserted.filter((p) => !have.has(p.id))];
      });
      qc.setQueryData<ChatMessage[]>(chatKey(tripId), (l) =>
        l?.map((m) => (m.id === message.id ? { ...m, proposal_applied: true } : m)),
      );
      void qc.invalidateQueries({ queryKey: tripKeys.counts(tripId) });
      toast.success(copy.chat.applied);
    },
    onError: () => toast.error(copy.chat.applyFailed),
  });
}

export function useSaveAiSettings(tripId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: {
      ai_provider: 'gemini' | 'openrouter';
      ai_model: string | null;
      ai_fallback: boolean;
    }) => {
      const { error } = await db().from('trips').update(patch).eq('id', tripId);
      if (error) throw error;
      return patch;
    },
    onSuccess: (patch) => {
      qc.setQueryData<Trip | null>(tripKeys.trip(tripId), (t) => (t ? { ...t, ...patch } : t));
      toast.success(copy.chat.settingsSaved);
    },
    onError: () => toast.error(copy.common.saveFailed),
  });
}
