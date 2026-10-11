import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineQueue, isNetworkError, shouldPersist, type KV, type QueuedOp } from '@/lib/offlineQueue';
import { buildCard, languageFor, mergeLocal, nameForDriver, type OfflineCard } from '@/lib/offline';

function memoryKV(): KV & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(k: string) {
      return data.get(k) as T | undefined;
    },
    async set(k: string, v: unknown) {
      data.set(k, v);
    },
  };
}

const toggle = (id: string, checked: boolean): QueuedOp => ({
  type: 'checklist.update',
  id,
  patch: { checked },
});
const note = (id: string, n: string | null): QueuedOp => ({ type: 'place.note', id, note: n });
const expense = (id: string): QueuedOp => ({
  type: 'expense.save',
  tripId: 't',
  id,
  data: { id },
  splits: [],
});

describe('OfflineQueue', () => {
  let q: OfflineQueue;
  beforeEach(() => {
    q = new OfflineQueue(memoryKV());
  });

  it('flushes in order and empties the queue', async () => {
    await q.enqueue('t', toggle('a', true));
    await q.enqueue('t', note('p1', 'hi'));
    await q.enqueue('t', expense('e1'));
    const seen: string[] = [];
    const r = await q.flush(async (op) => void seen.push(op.type));
    expect(seen).toEqual(['checklist.update', 'place.note', 'expense.save']);
    expect(r).toMatchObject({ done: 3, remaining: 0 });
    expect(await q.size()).toBe(0);
  });

  it('coalesces repeated toggles, notes and saves of the same target (last write wins)', async () => {
    await q.enqueue('t', toggle('a', true));
    await q.enqueue('t', toggle('a', false));
    await q.enqueue('t', note('p', 'one'));
    await q.enqueue('t', note('p', 'two'));
    await q.enqueue('t', expense('e'));
    await q.enqueue('t', expense('e'));
    const ops = (await q.list()).map((i) => i.op);
    expect(ops).toHaveLength(3);
    expect(ops[0]).toMatchObject({ type: 'checklist.update', patch: { checked: false } });
    expect(ops[1]).toMatchObject({ note: 'two' });
  });

  it('stops on a network error, keeps the rest, and resumes later without duplicates', async () => {
    await q.enqueue('t', toggle('a', true));
    await q.enqueue('t', toggle('b', true));
    await q.enqueue('t', toggle('c', true));
    const calls: string[] = [];
    let offline = true;
    const handler = async (op: QueuedOp) => {
      if (op.type !== 'checklist.update') return;
      if (op.id === 'b' && offline) throw new TypeError('Failed to fetch');
      calls.push(op.id);
    };
    const first = await q.flush(handler);
    expect(first).toMatchObject({ done: 1, remaining: 2 });
    offline = false;
    const second = await q.flush(handler);
    expect(second).toMatchObject({ done: 2, remaining: 0 });
    expect(calls).toEqual(['a', 'b', 'c']);
  });

  it('drops an item the server rejects so it cannot block the queue', async () => {
    await q.enqueue('t', toggle('bad', true));
    await q.enqueue('t', toggle('good', true));
    const r = await q.flush(async (op) => {
      if (op.type === 'checklist.update' && op.id === 'bad')
        throw { message: 'permission denied', code: '42501' };
    });
    expect(r.done).toBe(1);
    expect(r.dropped.map((d) => d.op.type)).toEqual(['checklist.update']);
    expect(r.remaining).toBe(0);
  });

  it('classifies network errors', () => {
    expect(isNetworkError(new TypeError('x'))).toBe(true);
    expect(isNetworkError(new Error('Failed to fetch'))).toBe(true);
    expect(isNetworkError({ message: 'permission denied' })).toBe(false);
    vi.stubGlobal('navigator', { onLine: false });
    expect(isNetworkError(new Error('anything'))).toBe(true);
    vi.unstubAllGlobals();
  });
});

describe('persistence filter', () => {
  it('persists trip data only (no AI, search, invites, signed URLs)', () => {
    for (const k of [
      'trips',
      'trip',
      'members',
      'places',
      'checklist',
      'expenses',
      'reservations',
      'files',
      'settlements',
      'counts',
      'fx',
    ])
      expect(shouldPersist([k, 'x']), k).toBe(true);
    for (const k of ['chat', 'ai-status', 'invite', 'footprints', 'saved-places'])
      expect(shouldPersist([k]), k).toBe(false);
    expect(shouldPersist([])).toBe(false);
  });
});

describe('offline cards', () => {
  const place = {
    id: 'p1',
    name: '센소지',
    address: '도쿄 아사쿠사',
    lat: 35.71,
    lng: 139.79,
    google_place_id: 'ChIJabc',
  };
  it('maps a country to a language and builds a card with coordinates', () => {
    expect(languageFor('JP')).toBe('ja');
    expect(languageFor('kr')).toBe('ko');
    expect(languageFor('ZZ')).toBeNull();
    const c = buildCard(place, 'trip1', new Date('2026-10-12T00:00:00Z'));
    expect(c).toMatchObject({
      id: 'p1',
      tripId: 'trip1',
      name: '센소지',
      lat: 35.71,
      localName: null,
      savedAt: '2026-10-12T00:00:00.000Z',
    });
  });
  it('merges local-language details without losing stored fields', () => {
    const c = buildCard(place, 't');
    const m = mergeLocal(c, { displayName: { text: '浅草寺' }, formattedAddress: '東京都台東区浅草2-3-1' });
    expect(m).toMatchObject({ localName: '浅草寺', localAddress: '東京都台東区浅草2-3-1', name: '센소지' });
    expect(mergeLocal(c, null)).toEqual(c);
    expect(mergeLocal(c, { displayName: { text: 5 } })).toEqual(c);
  });
  it('picks the driver card text: local name when stored, else the stored name', () => {
    const c: OfflineCard = {
      ...buildCard(place, 't'),
      localName: '浅草寺',
      localAddress: '東京都台東区浅草2-3-1',
    };
    expect(nameForDriver(c, place)).toEqual({
      name: '센소지',
      localName: '浅草寺',
      address: '東京都台東区浅草2-3-1',
    });
    expect(nameForDriver(undefined, place)).toEqual({
      name: '센소지',
      localName: null,
      address: '도쿄 아사쿠사',
    });
  });
});
