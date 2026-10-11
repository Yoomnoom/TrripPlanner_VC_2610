import { describe, expect, it } from 'vitest';
import {
  localNow,
  localStamp,
  nextPlace,
  tripPhaseInTz,
  todayIndexOf,
  untilLabel,
  upcomingReservations,
} from '@/lib/phase';
import { buildQuickExpense, keypad } from '@/lib/quickExpense';
import { directionsLink, nearbyLink } from '@/lib/external';

const p = (id: string, day: number | null, s: string | null, e: string | null = null) => ({
  id,
  day_index: day,
  start_time: s && `${s}:00`,
  end_time: e && `${e}:00`,
  position: 0,
});

describe('nextPlace (SPEC F-7)', () => {
  const places = [
    p('a', 1, '09:00', '10:00'),
    p('b', 1, '12:30', '13:30'),
    p('c', 1, '18:00', '19:00'),
    p('d', 2, '09:30', '10:30'),
    p('x', 1, null),
  ];
  it('picks the soonest start at or after now', () => {
    expect(nextPlace(places, 1, 11 * 60)).toMatchObject({
      kind: 'next',
      place: { id: 'b' },
      minutesUntil: 90,
    });
    expect(nextPlace(places, 1, 12 * 60 + 30)).toMatchObject({
      kind: 'next',
      place: { id: 'b' },
      minutesUntil: 0,
    });
    expect(nextPlace(places, 1, 7 * 60)).toMatchObject({ place: { id: 'a' } });
  });
  it('is done after the last start, pointing at the first place of tomorrow', () => {
    expect(nextPlace(places, 1, 18 * 60 + 1)).toMatchObject({ kind: 'done', tomorrowFirst: { id: 'd' } });
    expect(nextPlace(places, 2, 23 * 60)).toEqual({ kind: 'done', tomorrowFirst: null });
  });
  it('ignores ideas, untimed places and other days', () => {
    expect(nextPlace([p('i', null, '10:00'), p('u', 1, null)], 1, 0)).toEqual({
      kind: 'done',
      tomorrowFirst: null,
    });
  });
});

describe('tripPhaseInTz (SPEC F-7)', () => {
  const trip = { start: '2026-10-12', end: '2026-10-14' };
  it('judges by the destination local date, which can differ from Korea by a day', () => {
    const now = new Date('2026-10-11T20:00:00Z'); // 10-12 05:00 in Seoul, 10-11 13:00 in Paris
    expect(tripPhaseInTz(trip, 'Asia/Seoul', now)).toMatchObject({ kind: 'during', day: 1 });
    expect(tripPhaseInTz(trip, 'Europe/Paris', now)).toMatchObject({ kind: 'before', daysLeft: 1 });
  });
  it('includes the boundary days', () => {
    expect(tripPhaseInTz(trip, 'Asia/Tokyo', new Date('2026-10-14T14:59:00Z'))).toMatchObject({
      kind: 'during',
      day: 3,
    }); // 23:59 in Tokyo
    expect(tripPhaseInTz(trip, 'Asia/Tokyo', new Date('2026-10-14T15:00:00Z'))).toEqual({ kind: 'after' }); // 00:00 next day
  });
  it('reads the local clock and Day index', () => {
    expect(localNow('Asia/Tokyo', new Date('2026-10-12T03:20:00Z'))).toEqual({
      date: '2026-10-12',
      minutes: 12 * 60 + 20,
    });
    expect(localStamp('Asia/Tokyo', new Date('2026-10-12T03:20:00Z'))).toBe('2026-10-12T12:20');
    expect(todayIndexOf(trip, '2026-10-13')).toBe(1);
    expect(todayIndexOf(trip, '2026-10-20')).toBeNull();
  });
});

describe('labels and reservations', () => {
  it('formats the wait', () => {
    expect(untilLabel(0)).toBe('지금');
    expect(untilLabel(30)).toBe('30분 후');
    expect(untilLabel(90)).toBe('1시간 30분 후');
    expect(untilLabel(120)).toBe('2시간 후');
  });
  it('lists upcoming reservations soonest first', () => {
    const list = [
      { id: 'a', starts_at: '2026-10-12T09:00:00' },
      { id: 'b', starts_at: '2026-10-12T15:00:00' },
      { id: 'c', starts_at: null },
      { id: 'd', starts_at: '2026-10-11T09:00:00' },
      { id: 'e', starts_at: '2026-10-13T08:00:00' },
    ];
    expect(upcomingReservations(list, '2026-10-12T10:00', 2).map((r) => r.id)).toEqual(['b', 'e']);
  });
});

describe('links', () => {
  it('builds directions with the place id and the travel mode', () => {
    const u = directionsLink({ lat: 35.1, lng: 139.2, googlePlaceId: 'ChIJabc' }, 'transit');
    expect(u).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=35.1,139.2&destination_place_id=ChIJabc&travelmode=transit',
    );
    expect(directionsLink({ lat: 1, lng: 2, googlePlaceId: 'fake:x' }, 'drive')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=1,2&travelmode=driving',
    );
    expect(directionsLink({ lat: 1, lng: 2 }, 'walk')).toContain('travelmode=walking');
  });
  it('builds a nearby search link', () => {
    expect(nearbyLink('약국', { lat: 35.1, lng: 139.2 })).toBe(
      'https://www.google.com/maps/search/%EC%95%BD%EA%B5%AD/@35.1,139.2,16z',
    );
  });
});

describe('quick expense', () => {
  const base = {
    id: 'e1',
    amount: 1000,
    currency: 'JPY',
    rate: 8.4768,
    category: 'food',
    paidBy: 'a',
    memberIds: ['a', 'b', 'c'],
    dayIndex: 1,
    tripStart: '2026-10-09',
  };
  it('splits equally, sums exactly and fills the day', () => {
    const e = buildQuickExpense(base)!;
    expect(e.amount_krw).toBe(8477);
    expect(e.splits.reduce((s, x) => s + x.share_krw, 0)).toBe(e.amount_krw);
    expect(e.splits.find((s) => s.member_id === 'a')!.share_krw).toBe(2827); // payer takes the remainder
    expect(e).toMatchObject({
      day_index: 1,
      spent_on: '2026-10-10',
      title: '식비',
      payment_method: 'card',
      currency: 'JPY',
    });
  });
  it('rejects invalid input', () => {
    expect(buildQuickExpense({ ...base, amount: 0 })).toBeNull();
    expect(buildQuickExpense({ ...base, rate: 0 })).toBeNull();
    expect(buildQuickExpense({ ...base, memberIds: [] })).toBeNull();
  });
  it('keypad: digits, one dot, no leading zero, cap, backspace', () => {
    let s = '';
    for (const k of ['0', '0', '5', '.', '.', '2', '5']) s = keypad(s, k);
    expect(s).toBe('5.25');
    expect(keypad('', '.')).toBe('0.');
    expect(keypad('12', 'back')).toBe('1');
    expect(keypad('1234567890', '1')).toBe('1234567890');
    expect(keypad('1', 'x')).toBe('1');
  });
});
