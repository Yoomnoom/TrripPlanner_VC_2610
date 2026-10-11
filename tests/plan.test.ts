import { describe, expect, it } from 'vitest';
import {
  groupByDay,
  insertAt,
  legLabel,
  nextMode,
  nextSlot,
  overlapping,
  parseCoords,
  reflowDay,
  sortDay,
  validTimes,
} from '@/lib/plan';

const p = (id: string, day: number | null, s: string | null, e: string | null, position = 0, extra = {}) => ({
  id,
  day_index: day,
  start_time: s && `${s}:00`,
  end_time: e && `${e}:00`,
  position,
  ...extra,
});

describe('sortDay / groupByDay', () => {
  it('sorts by start time, untimed last, ties by position', () => {
    const list = [
      p('c', 0, null, null, 1),
      p('b', 0, '10:00', '11:00', 2),
      p('a', 0, '09:00', '10:00', 3),
      p('d', 0, '10:00', '11:00', 1),
    ];
    expect(sortDay(list).map((x) => x.id)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('splits days and ideas, extends days when places exceed the trip length', () => {
    const g = groupByDay(
      [p('i', null, null, null), p('x', 0, '09:00', '10:00'), p('y', 3, '09:00', '10:00')],
      2,
    );
    expect(g.days).toHaveLength(4);
    expect(g.ideas.map((x) => x.id)).toEqual(['i']);
    expect(g.days[3].map((x) => x.id)).toEqual(['y']);
  });
});

describe('times', () => {
  it('validates end after start', () => {
    expect(validTimes('09:00', '10:00')).toBe(true);
    expect(validTimes('10:00', '10:00')).toBe(false);
    expect(validTimes('', '10:00')).toBe(false);
  });
  it('detects overlap but not touching ranges or itself', () => {
    const day = [p('a', 0, '09:00', '10:00'), p('b', 0, '10:00', '11:00')];
    expect(overlapping(day, null, '09:30', '10:30').map((x) => x.id)).toEqual(['a', 'b']);
    expect(overlapping(day, null, '10:00', '10:30').map((x) => x.id)).toEqual(['b']);
    expect(overlapping(day, 'a', '09:00', '10:00')).toEqual([]);
  });
  it('picks the next free slot', () => {
    expect(nextSlot([])).toEqual({ start: '09:00', end: '10:00' });
    expect(nextSlot([p('a', 0, '09:00', '10:30')])).toEqual({ start: '10:45', end: '11:45' });
    expect(nextSlot([p('a', 0, '23:00', '23:50')]).end).toBe('23:59');
  });
});

describe('reflowDay', () => {
  it('keeps durations, uses 15 min gaps by default', () => {
    const { patches, overflow } = reflowDay(
      [p('b', 0, '11:00', '12:00'), p('a', 0, '09:00', '10:30')],
      9 * 60,
    );
    expect(overflow).toBe(false);
    expect(patches).toEqual([
      { id: 'b', start_time: '09:00', end_time: '10:00' },
      { id: 'a', start_time: '10:15', end_time: '11:45' },
    ]);
  });
  it('uses the cached leg only when it comes from the previous place', () => {
    const a = p('a', 0, '09:00', '10:00');
    const good = p('b', 0, '10:00', '11:00', 0, { leg_from_place_id: 'a', leg_duration_s: 25 * 60 });
    const stale = p('c', 0, '11:00', '12:00', 0, { leg_from_place_id: 'zzz', leg_duration_s: 40 * 60 });
    const { patches } = reflowDay([a, good, stale], 9 * 60);
    expect(patches.map((x) => x.start_time)).toEqual(['09:00', '10:25', '11:40']);
  });
  it('clamps at 23:59 and reports overflow', () => {
    const { patches, overflow } = reflowDay(
      [p('a', 0, '20:00', '23:00'), p('b', 0, '23:00', '23:50')],
      20 * 60,
    );
    expect(overflow).toBe(true);
    expect(patches[1].end_time).toBe('23:59');
    expect(patches[1].start_time < patches[1].end_time).toBe(true);
  });
});

describe('insertAt', () => {
  it('moves within and across lists', () => {
    const a = { id: 'a' },
      b = { id: 'b' },
      c = { id: 'c' };
    expect(insertAt([a, b, c], a, 2).map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expect(insertAt([b, c], a, 0).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(insertAt([b], a, 99).map((x) => x.id)).toEqual(['b', 'a']);
  });
});

describe('coords / labels', () => {
  it('parses coordinates', () => {
    expect(parseCoords('35.68, 139.76')).toEqual({ lat: 35.68, lng: 139.76 });
    expect(parseCoords('-33.8 151.2')).toEqual({ lat: -33.8, lng: 151.2 });
    expect(parseCoords('91, 0')).toBeNull();
    expect(parseCoords('abc')).toBeNull();
  });
  it('formats legs with ~ for estimates', () => {
    expect(legLabel(23 * 60, 1400, false)).toBe('23분 1.4km');
    expect(legLabel(23 * 60, 1400, true)).toBe('~23분 1.4km');
    expect(legLabel(65 * 60, 850, true)).toBe('~1시간 5분 850m');
    expect(legLabel(10, 20, false)).toBe('1분 20m');
  });
  it('cycles modes', () => {
    expect(nextMode('walk')).toBe('transit');
    expect(nextMode('drive')).toBe('walk');
  });
});
