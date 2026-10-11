import { describe, expect, it } from 'vitest';
import { csvField, toCsv } from '@/lib/csv';
import { scheduleToCsv, slotFromDates, toEvents, type CalPlace } from '@/lib/calendar';

const p = (
  id: string,
  day: number | null,
  s: string | null,
  e: string | null,
  name = id,
  extra = {},
): CalPlace => ({
  id,
  day_index: day,
  start_time: s && `${s}:00`,
  end_time: e && `${e}:00`,
  position: 0,
  name,
  category: 'food',
  ...extra,
});

describe('csv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('l1\nl2')).toBe('"l1\nl2"');
    expect(csvField(null)).toBe('');
  });
  it('defuses spreadsheet formulas but keeps plain negative numbers', () => {
    expect(csvField('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvField('@cmd')).toBe("'@cmd");
    expect(csvField(-5)).toBe('-5');
  });
  it('joins rows with CRLF', () => {
    expect(toCsv(['a', 'b'], [[1, 'x,y']])).toBe('a,b\r\n1,"x,y"');
  });
});

describe('calendar events', () => {
  it('maps timed day places to real dates and skips ideas/untimed', () => {
    const ev = toEvents(
      [p('a', 1, '09:00', '10:30'), p('i', null, null, null), p('u', 0, null, null)],
      '2026-10-30',
    );
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({
      id: 'a',
      start: '2026-10-31T09:00:00',
      end: '2026-10-31T10:30:00',
      borderColor: '#F97316',
    });
  });
  it('turns dragged dates back into day + times', () => {
    const s = new Date(2026, 9, 31, 13, 15);
    const e = new Date(2026, 9, 31, 14, 0);
    expect(slotFromDates(s, e, '2026-10-30', 4)).toEqual({ day: 1, start: '13:15', end: '14:00' });
  });
  it('clamps events that cross midnight or have no end, and rejects days outside the trip', () => {
    const s = new Date(2026, 9, 30, 23, 0);
    expect(slotFromDates(s, new Date(2026, 9, 31, 1, 0), '2026-10-30', 4)?.end).toBe('23:59');
    expect(slotFromDates(new Date(2026, 9, 30, 9, 0), null, '2026-10-30', 4)).toEqual({
      day: 0,
      start: '09:00',
      end: '10:00',
    });
    expect(slotFromDates(new Date(2026, 10, 5, 9, 0), null, '2026-10-30', 4)).toBeNull();
  });
});

describe('schedule csv', () => {
  it('exports Day, times, name, Korean category, address, note', () => {
    const csv = scheduleToCsv([
      [p('a', 0, '09:00', '10:00', '이치란, 시부야', { address: '도쿄', note: '웨이팅' })],
      [],
    ]);
    expect(csv.split('\r\n')).toEqual([
      'Day,시작,종료,이름,카테고리,주소,메모',
      'Day 1,09:00,10:00,"이치란, 시부야",식사,도쿄,웨이팅',
    ]);
  });
});
