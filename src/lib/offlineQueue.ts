/** Minimal async key-value storage (idb-keyval in the app, a Map in tests). */
export interface KV {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

/** The only writes that may be queued offline (SPEC F-3-4). Everything else is disabled while offline. */
export type QueuedOp =
  | {
      type: 'checklist.update';
      id: string;
      patch: { checked?: boolean; checked_by?: string | null; title?: string };
    }
  | {
      type: 'expense.save';
      tripId: string;
      id: string;
      data: Record<string, unknown>;
      splits: { member_id: string; share_krw: number }[];
    }
  | { type: 'place.note'; id: string; note: string | null };

export interface QueueItem {
  /** Client-generated, so a retry after a half-finished flush cannot create a duplicate. */
  id: string;
  op: QueuedOp;
  tripId: string;
  createdAt: number;
}

export type Handler = (op: QueuedOp) => Promise<void>;

/** True for failures that mean "no connection" (retry later) as opposed to "the server said no" (drop). */
export function isNetworkError(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? '');
  return e instanceof TypeError || /failed to fetch|network|load failed|fetch failed|timeout/i.test(msg);
}

const KEY = 'tp:offline-queue';

/**
 * FIFO queue of offline writes. Items stay until their handler succeeds; a network failure stops the flush so order is
 * kept and nothing is lost; a server rejection drops that one item (reported) so it cannot block the rest forever.
 */
export class OfflineQueue {
  constructor(private kv: KV) {}

  private async read(): Promise<QueueItem[]> {
    return (await this.kv.get<QueueItem[]>(KEY)) ?? [];
  }

  async size(): Promise<number> {
    return (await this.read()).length;
  }

  async list(): Promise<QueueItem[]> {
    return this.read();
  }

  async enqueue(tripId: string, op: QueuedOp, now = Date.now()): Promise<QueueItem> {
    const items = await this.read();
    const item: QueueItem = { id: crypto.randomUUID(), op, tripId, createdAt: now };
    // Coalesce: only the last pending update of the same checklist item / place note matters.
    const same = (q: QueueItem) =>
      (op.type === 'checklist.update' &&
        q.op.type === 'checklist.update' &&
        q.op.id === op.id &&
        'checked' in op.patch &&
        'checked' in q.op.patch) ||
      (op.type === 'place.note' && q.op.type === 'place.note' && q.op.id === op.id) ||
      (op.type === 'expense.save' && q.op.type === 'expense.save' && q.op.id === op.id);
    await this.kv.set(KEY, [...items.filter((q) => !same(q)), item]);
    return item;
  }

  /** Runs the queue in order. Returns what happened so the UI can report it. */
  async flush(handle: Handler): Promise<{ done: number; dropped: QueueItem[]; remaining: number }> {
    let items = await this.read();
    let done = 0;
    const dropped: QueueItem[] = [];
    while (items.length > 0) {
      const [head, ...rest] = items;
      try {
        await handle(head.op);
        done++;
      } catch (e) {
        if (isNetworkError(e)) break; // keep it (and everything after it) for next time
        dropped.push(head);
      }
      items = rest;
      await this.kv.set(KEY, items);
    }
    return { done, dropped, remaining: items.length };
  }
}

/** Which TanStack queries are written to the device (trip data only; no AI, search or signed URLs). */
const PERSIST_ROOTS = new Set([
  'trips',
  'trip',
  'members',
  'places',
  'checklist',
  'expenses',
  'settlements',
  'reservations',
  'files',
  'counts',
  'destinations',
  'fx',
  'me',
]);

export const shouldPersist = (queryKey: readonly unknown[]) =>
  typeof queryKey[0] === 'string' && PERSIST_ROOTS.has(queryKey[0]);

export const PERSIST_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
