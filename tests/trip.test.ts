import { describe, expect, it } from 'vitest';
import {
  dayIndexOf,
  dayYmd,
  defaultTitle,
  formatMdWeekday,
  formatDuration,
  formatRange,
  initialOf,
  inviteUrl,
  nicknameSchema,
  tripDays,
  tripPhase,
} from '@/lib/trip';

describe('trip dates', () => {
  it('counts nights and days inclusively', () => {
    expect(tripDays('2026-10-09', '2026-10-12')).toBe(4);
    expect(formatDuration('2026-10-09', '2026-10-12')).toBe('3박 4일');
    expect(formatDuration('2026-10-09', '2026-10-09')).toBe('당일치기');
  });
  it('handles month and year boundaries and DST dates', () => {
    expect(tripDays('2026-12-30', '2027-01-02')).toBe(4);
    expect(tripDays('2026-03-28', '2026-03-30')).toBe(3);
    expect(tripDays('2026-10-30', '2026-11-02')).toBe(4);
  });
  it('formats ranges in Korean', () => {
    expect(formatRange('2026-10-09', '2026-10-12')).toBe('10월 9일 ~ 10월 12일');
  });
  it('builds the default title', () => {
    expect(defaultTitle('도쿄', '2026-10-09', '2026-10-12')).toBe('도쿄 3박 4일 여행');
    expect(defaultTitle('  ', '2026-10-09', '2026-10-12')).toBe('내 3박 4일 여행');
  });
});

describe('tripPhase', () => {
  it('is before / during / after', () => {
    expect(tripPhase('2026-10-09', '2026-10-12', '2026-09-15')).toEqual({ kind: 'before', daysLeft: 24 });
    expect(tripPhase('2026-10-09', '2026-10-12', '2026-10-09')).toEqual({ kind: 'during', day: 1, total: 4 });
    expect(tripPhase('2026-10-09', '2026-10-12', '2026-10-12')).toEqual({ kind: 'during', day: 4, total: 4 });
    expect(tripPhase('2026-10-09', '2026-10-12', '2026-10-13')).toEqual({ kind: 'after' });
  });
});

describe('invite helpers', () => {
  it('builds invite urls without double slashes', () => {
    expect(inviteUrl('http://localhost:5173/', 'abc')).toBe('http://localhost:5173/join/abc');
  });
  it('validates nicknames (1-20 chars, trimmed)', () => {
    expect(nicknameSchema.safeParse('  민수 ').data).toBe('민수');
    expect(nicknameSchema.safeParse('   ').success).toBe(false);
    expect(nicknameSchema.safeParse('가'.repeat(21)).success).toBe(false);
    expect(nicknameSchema.safeParse('가'.repeat(20)).success).toBe(true);
  });
  it('takes the first code point as avatar initial', () => {
    expect(initialOf('민수')).toBe('민');
    expect(initialOf('😀a')).toBe('😀');
    expect(initialOf('')).toBe('?');
  });
});

describe('day labels', () => {
  it('adds days across month/year boundaries', () => {
    expect(dayYmd('2026-10-09', 0)).toBe('2026-10-09');
    expect(dayYmd('2026-10-30', 3)).toBe('2026-11-02');
    expect(dayYmd('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('formats with weekday', () => {
    expect(formatMdWeekday('2026-10-09')).toBe('10월 9일(금)');
  });
});

describe('dayIndexOf', () => {
  it('maps dates inside the trip and rejects outside ones', () => {
    expect(dayIndexOf('2026-10-09', '2026-10-09', 4)).toBe(0);
    expect(dayIndexOf('2026-10-09', '2026-10-12', 4)).toBe(3);
    expect(dayIndexOf('2026-10-09', '2026-10-13', 4)).toBeNull();
    expect(dayIndexOf('2026-10-09', '2026-10-08', 4)).toBeNull();
  });
});
