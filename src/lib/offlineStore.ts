import { useEffect, useState, useSyncExternalStore } from 'react';
import { get, set, createStore } from 'idb-keyval';
import { isNetworkError, OfflineQueue, type KV, type QueuedOp } from '@/lib/offlineQueue';
import type { OfflineCard } from '@/lib/offline';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/types/db';

const store = createStore('trip-planner', 'kv');

/** idb-keyval adapter. Falls back to an in-memory Map when IndexedDB is unavailable (private mode, old browsers). */
const memory = new Map<string, unknown>();
export const idbKV: KV = {
  async get<T>(key: string) {
    try {
      return (await get<T>(key, store)) ?? undefined;
    } catch {
      return memory.get(key) as T | undefined;
    }
  },
  async set(key: string, value: unknown) {
    try {
      await set(key, value, store);
    } catch {
      memory.set(key, value);
    }
  },
};

export const queue = new OfflineQueue(idbKV);

// ---------------------------------------------------------------- online state

const subscribe = (cb: () => void) => {
  window.addEventListener('online', cb);
  window.addEventListener('offline', cb);
  return () => {
    window.removeEventListener('online', cb);
    window.removeEventListener('offline', cb);
  };
};

export const useOnline = () =>
  useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );

// ---------------------------------------------------------------- queue plumbing

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Number of writes waiting to sync (shown in the offline banner). */
export function useQueueSize(): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => void queue.size().then((v) => alive && setN(v));
    refresh();
    listeners.add(refresh);
    return () => {
      alive = false;
      listeners.delete(refresh);
    };
  }, []);
  return n;
}

/**
 * Runs `run` now when online; when offline (or the request fails for lack of connection) the operation is queued and
 * the call still resolves, so the optimistic UI state stays. Server rejections are rethrown (and rolled back).
 */
export async function writeOrQueue(
  tripId: string,
  op: QueuedOp,
  run: () => Promise<void>,
): Promise<'sent' | 'queued'> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    await queue.enqueue(tripId, op);
    notify();
    return 'queued';
  }
  try {
    await run();
    return 'sent';
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    await queue.enqueue(tripId, op);
    notify();
    return 'queued';
  }
}

/** Replays one queued operation against Supabase (each write is idempotent: update by id / save_expense by uuid). */
export async function applyOp(op: QueuedOp): Promise<void> {
  if (!supabase) throw new Error('ENV_MISSING');
  if (op.type === 'checklist.update') {
    const { error } = await supabase.from('checklist_items').update(op.patch).eq('id', op.id);
    if (error) throw error;
  } else if (op.type === 'place.note') {
    const { error } = await supabase.from('places').update({ note: op.note }).eq('id', op.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.rpc('save_expense', {
      p_trip: op.tripId,
      p_id: op.id,
      p_data: op.data as Json,
      p_splits: op.splits,
    });
    if (error) throw error;
  }
}

/** Flushes the queue; returns what happened. Safe to call repeatedly (a running flush is shared). */
let running: Promise<Awaited<ReturnType<typeof queue.flush>>> | null = null;
export function flushQueue() {
  running ??= queue.flush(applyOp).finally(() => {
    running = null;
    notify();
  });
  return running;
}

// ---------------------------------------------------------------- offline cards (device only)

const cardsKey = (tripId: string) => `tp:cards:${tripId}`;

export const loadCards = async (tripId: string): Promise<OfflineCard[]> =>
  (await idbKV.get<OfflineCard[]>(cardsKey(tripId))) ?? [];
export const saveCards = (tripId: string, cards: OfflineCard[]) => idbKV.set(cardsKey(tripId), cards);
