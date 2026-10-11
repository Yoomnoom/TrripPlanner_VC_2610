import { describe, expect, it } from 'vitest';
import { COUNTRY_INFO, infoOf } from '@/data/country-info';
import { COUNTRIES } from '@/lib/countries';
import { dateIn, describeDiff, diffFromKorea, offsetMinutes, timeIn } from '@/lib/tz';
import { coveredDays, describeCode, lastYear, parseDaily, planWeather, rowsByDay } from '@/lib/weather';

describe('time zones', () => {
  const winter = new Date('2026-01-15T03:20:00Z');
  const summer = new Date('2026-07-15T03:20:00Z');
  it('formats local time and date in a zone', () => {
    expect(timeIn('Asia/Tokyo', winter)).toBe('12:20');
    expect(timeIn('Asia/Seoul', winter)).toBe('12:20');
    expect(timeIn('Europe/Paris', winter)).toBe('04:20');
    expect(dateIn('Pacific/Auckland', new Date('2026-01-15T20:00:00Z'))).toBe('2026-01-16'); // already tomorrow there
  });
  it('computes offsets including DST and half-hour zones', () => {
    expect(offsetMinutes('Asia/Seoul', winter)).toBe(540);
    expect(offsetMinutes('Europe/Paris', winter)).toBe(60);
    expect(offsetMinutes('Europe/Paris', summer)).toBe(120);
    expect(offsetMinutes('Asia/Kolkata', winter)).toBe(330);
  });
  it('describes the difference from Korea', () => {
    expect(describeDiff(diffFromKorea('Asia/Tokyo', winter))).toBe('한국과 시차 없음');
    expect(describeDiff(diffFromKorea('Asia/Bangkok', winter))).toBe('한국보다 2시간 느려요');
    expect(describeDiff(diffFromKorea('Europe/Paris', summer))).toBe('한국보다 7시간 느려요');
    expect(describeDiff(diffFromKorea('Pacific/Auckland', winter))).toBe('한국보다 4시간 빨라요');
    expect(describeDiff(diffFromKorea('Asia/Kolkata', winter))).toBe('한국보다 3시간 30분 느려요');
  });
});

describe('weather source rules', () => {
  const today = '2026-10-12';
  const at = (start: string, end: string) => planWeather({ start, end }, 35.68, 139.76, today);
  it('uses the forecast when the trip starts inside the 16-day window', () => {
    const p = at('2026-10-20', '2026-10-23');
    expect(p.kind).toBe('forecast');
    expect(p.url).toContain('https://api.open-meteo.com/v1/forecast');
    expect(p.url).toContain('start_date=2026-10-20');
  });
  it('clips a trip that runs past the window and a trip already under way', () => {
    expect(at('2026-10-25', '2026-11-05')).toMatchObject({
      kind: 'forecast',
      start: '2026-10-25',
      end: '2026-10-27',
    }); // window ends 10-27
    expect(at('2026-10-10', '2026-10-14')).toMatchObject({
      kind: 'forecast',
      start: '2026-10-12',
      end: '2026-10-14',
    });
  });
  it('uses last year same dates beyond the window, flagged as not a forecast', () => {
    const p = at('2026-12-20', '2026-12-23');
    expect(p).toMatchObject({ kind: 'archive-last-year', start: '2025-12-20', end: '2025-12-23' });
    expect(p.url).toContain('https://archive-api.open-meteo.com/v1/archive');
  });
  it('uses real archive data for finished trips', () => {
    expect(at('2026-09-01', '2026-09-04')).toMatchObject({
      kind: 'archive-actual',
      start: '2026-09-01',
      end: '2026-09-04',
    });
  });
  it('handles the window edge and Feb 29', () => {
    expect(at('2026-10-27', '2026-10-28').kind).toBe('forecast'); // day 16 = 10-27
    expect(at('2026-10-28', '2026-10-29').kind).toBe('archive-last-year');
    expect(lastYear('2028-02-29')).toBe('2027-02-28');
  });
  it('maps rows back to trip days (last-year rows are shifted)', () => {
    const plan = at('2026-12-20', '2026-12-21');
    const rows = parseDaily({
      daily: {
        time: ['2025-12-20', '2025-12-21'],
        weather_code: [0, 61],
        temperature_2m_max: [12, 9],
        temperature_2m_min: [3, null],
        precipitation_probability_max: [null, null],
      },
    });
    const m = rowsByDay(plan, rows, '2026-12-20', 2);
    expect(m.get(0)).toMatchObject({ maxC: 12, code: 0 });
    expect(m.get(1)).toMatchObject({ minC: null, code: 61 });
    expect(parseDaily(null)).toEqual([]);
    expect(coveredDays(at('2026-10-25', '2026-11-05'), '2026-10-25', '2026-11-05')).toBe(3);
  });
  it('describes WMO codes', () => {
    expect(describeCode(0).label).toBe('맑음');
    expect(describeCode(63).label).toBe('비');
    expect(describeCode(95).label).toBe('뇌우');
    expect(describeCode(null).label).toBe('정보 없음');
  });
});

describe('country info data', () => {
  it('covers every destination offered in the trip form, with valid zones', () => {
    for (const c of COUNTRIES) {
      if (c.code === 'KR' || infoOf(c.code)) continue;
    }
    const missing = COUNTRIES.filter((c) => !infoOf(c.code)).map((c) => c.code);
    expect(missing).toEqual([]);
    for (const [code, info] of Object.entries(COUNTRY_INFO)) {
      expect(info.timezones.length, code).toBeGreaterThan(0);
      for (const t of info.timezones) expect(() => timeIn(t.tz, new Date()), `${code} ${t.tz}`).not.toThrow();
      expect(info.currency, code).toMatch(/^[A-Z]{3}$/);
      expect(Math.abs(info.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(info.lng)).toBeLessThanOrEqual(180);
    }
  });
  it('looks up case-insensitively and returns null for unknown', () => {
    expect(infoOf('jp')?.currency).toBe('JPY');
    expect(infoOf('ZZ')).toBeNull();
    expect(infoOf(null)).toBeNull();
  });
});
