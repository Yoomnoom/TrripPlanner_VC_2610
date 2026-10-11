import type { LatLng } from '@/lib/geo';
import { reflow, toHHmm, toMin } from '@/lib/time';

/** Fields of a places row that the schedule logic needs. */
export interface Schedulable {
  id: string;
  day_index: number | null;
  start_time: string | null;
  end_time: string | null;
  position: number;
  leg_duration_s?: number | null;
  leg_from_place_id?: string | null;
}

export const DEFAULT_DURATION_MIN = 60;
export const DEFAULT_START_MIN = 9 * 60;
const DAY_END_MIN = 23 * 60 + 59;

/** DB `time` ('HH:MM:SS') → minutes, or null. */
export const timeToMin = (t: string | null | undefined) => (t ? toMin(t.slice(0, 5)) : null);
export const hm = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

/** Order within a day: start time ascending (untimed last), then position, then id for stability. */
export function sortDay<T extends Schedulable>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    const sa = timeToMin(a.start_time) ?? Infinity;
    const sb = timeToMin(b.start_time) ?? Infinity;
    if (sa !== sb) return sa < sb ? -1 : 1;
    return a.position - b.position || a.id.localeCompare(b.id);
  });
}

export function groupByDay<T extends Schedulable>(places: readonly T[], dayCount: number) {
  const maxIdx = places.reduce((m, p) => Math.max(m, p.day_index ?? -1), -1);
  const days: T[][] = Array.from({ length: Math.max(dayCount, maxIdx + 1) }, () => []);
  const ideas: T[] = [];
  for (const p of places) (p.day_index === null ? ideas : days[p.day_index]).push(p);
  return { days: days.map(sortDay), ideas: [...ideas].sort((a, b) => a.position - b.position) };
}

export const durationMin = (p: Pick<Schedulable, 'start_time' | 'end_time'>) => {
  const s = timeToMin(p.start_time);
  const e = timeToMin(p.end_time);
  return s !== null && e !== null && e > s ? e - s : DEFAULT_DURATION_MIN;
};

export const validTimes = (start: string, end: string) => !!start && !!end && toMin(end) > toMin(start);

/** Other places in the same day whose time range overlaps [start, end). Warning only, saving is allowed. */
export function overlapping<T extends Schedulable>(
  day: readonly T[],
  selfId: string | null,
  start: string,
  end: string,
) {
  const s = toMin(start);
  const e = toMin(end);
  return day.filter((p) => {
    if (p.id === selfId) return false;
    const ps = timeToMin(p.start_time);
    const pe = timeToMin(p.end_time);
    return ps !== null && pe !== null && ps < e && pe > s;
  });
}

/** Default slot for a new place at the end of a day: 15 min after the last timed place, else 09:00. */
export function nextSlot(day: readonly Schedulable[]) {
  const ends = day.map((p) => timeToMin(p.end_time)).filter((v): v is number => v !== null);
  const start = Math.min(
    ends.length ? Math.max(...ends) + 15 : DEFAULT_START_MIN,
    DAY_END_MIN - DEFAULT_DURATION_MIN,
  );
  return { start: toHHmm(start), end: toHHmm(start + DEFAULT_DURATION_MIN) };
}

export type TimePatch = { id: string; start_time: string; end_time: string };

/**
 * After a reorder: keep every duration, start from `firstStartMin`, put the cached leg time
 * (else 15 min) between places. Overflow past 23:59 is clamped and reported.
 */
export function reflowDay(
  ordered: readonly Schedulable[],
  firstStartMin: number,
): { patches: TimePatch[]; overflow: boolean } {
  const items = ordered.map((p, i) => {
    const prev = ordered[i - 1];
    const cached =
      prev && p.leg_from_place_id === prev.id && p.leg_duration_s
        ? Math.ceil(p.leg_duration_s / 60)
        : undefined;
    return { id: p.id, durationMin: durationMin(p), legMinFromPrev: cached };
  });
  let overflow = false;
  const patches = reflow(items, firstStartMin).map(({ id, startMin, endMin }) => {
    if (endMin > DAY_END_MIN) overflow = true;
    const end = Math.min(endMin, DAY_END_MIN);
    const start = Math.min(startMin, end - 1);
    return { id, start_time: toHHmm(start), end_time: toHHmm(end) };
  });
  return { patches, overflow };
}

/** Earliest start among timed places, else 09:00. */
export const dayFirstStart = (day: readonly Schedulable[]) => {
  const starts = day.map((p) => timeToMin(p.start_time)).filter((v): v is number => v !== null);
  return starts.length ? Math.min(...starts) : DEFAULT_START_MIN;
};

/** Move item `id` to `index` of `target` (a day's current order, which may not contain it yet). */
export function insertAt<T extends { id: string }>(target: readonly T[], item: T, index: number): T[] {
  const without = target.filter((p) => p.id !== item.id);
  const i = Math.max(0, Math.min(index, without.length));
  return [...without.slice(0, i), item, ...without.slice(i)];
}

/** '35.68, 139.76' → coordinates, or null when malformed / out of range. */
export function parseCoords(text: string): LatLng | null {
  const m = text.trim().match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  return Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** '~23분 1.4km' (estimates get the ~ prefix). */
export function legLabel(durationS: number, distanceM: number, estimated: boolean) {
  const min = Math.max(1, Math.round(durationS / 60));
  const time = min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`;
  const dist = distanceM >= 1000 ? `${(distanceM / 1000).toFixed(1)}km` : `${Math.round(distanceM)}m`;
  return `${estimated ? '~' : ''}${time} ${dist}`;
}

const MODES = ['walk', 'transit', 'drive'] as const;
export const nextMode = (m: (typeof MODES)[number]) => MODES[(MODES.indexOf(m) + 1) % MODES.length];
