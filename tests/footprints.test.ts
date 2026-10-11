import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { computeStats, suggestVisited, yearStreak } from '@/features/footprints/stats';
import { continentOf } from '@/lib/continents';
import { NUMERIC_TO_ALPHA2 } from '@/data/countryNumeric';
import { COUNTRIES } from '@/lib/countries';

describe('yearStreak (SPEC C-7 cases)', () => {
  it('counts the run ending this year or last year', () => {
    expect(yearStreak([2024, 2025, 2026], 2026)).toBe(3);
    expect(yearStreak([2022, 2024, 2025], 2026)).toBe(2);
    expect(yearStreak([], 2026)).toBe(0);
    expect(yearStreak([2023], 2026)).toBe(0);
    expect(yearStreak([2025], 2026)).toBe(1);
  });
});

describe('computeStats', () => {
  const today = new Date(2026, 9, 12); // 2026-10-12
  const trips = [
    { startDate: '2025-12-30', endDate: '2026-01-02', placeCount: 10, cities: ['도쿄', ' 오사카 '] },
    { startDate: '2026-03-01', endDate: '2026-03-03', placeCount: 5, cities: ['도쿄', ''] },
    { startDate: '2026-10-12', endDate: '2026-10-14', placeCount: 99, cities: ['파리'] }, // ends after today: ignored
    { startDate: '2026-12-01', endDate: '2026-12-05', placeCount: 99, cities: ['로마'] }, // future
  ];
  it('aggregates the seven stats over finished trips only', () => {
    expect(computeStats({ visitedCountryCodes: ['JP', 'jp', 'FR', 'KR'], pastTrips: trips, today })).toEqual({
      countries: 3,
      trips: 2,
      places: 15,
      cities: 2,
      days: 7,
      continents: 2,
      yearStreak: 2, // 2025 (Dec 30) and 2026
    });
  });
  it('is all zeros with nothing', () => {
    expect(computeStats({ visitedCountryCodes: [], pastTrips: [], today })).toEqual({
      countries: 0,
      trips: 0,
      places: 0,
      cities: 0,
      days: 0,
      continents: 0,
      yearStreak: 0,
    });
  });
  it('ignores unknown country codes for continents but still counts the country', () => {
    expect(computeStats({ visitedCountryCodes: ['ZZ'], pastTrips: [], today })).toMatchObject({
      countries: 1,
      continents: 0,
    });
  });
});

describe('suggestVisited', () => {
  it('suggests ended trips countries that are not visited yet, once each', () => {
    const trips = [
      { id: 'a', title: '도쿄', endDate: '2026-05-01', countryCodes: ['JP'] },
      { id: 'b', title: '오사카', endDate: '2026-06-01', countryCodes: ['jp', 'KR'] },
      { id: 'c', title: '미래', endDate: '2026-12-01', countryCodes: ['FR'] },
    ];
    expect(suggestVisited(trips, new Set(['KR']), '2026-10-12')).toEqual([
      { tripId: 'a', tripTitle: '도쿄', code: 'JP' },
    ]);
  });
});

describe('geo data integrity', () => {
  it('every map country has a continent, and destination picker countries are known', () => {
    const codes = Object.values(NUMERIC_TO_ALPHA2);
    expect(codes.length).toBeGreaterThan(150);
    expect(codes.filter((c) => continentOf(c) === null)).toEqual([]);
    expect(COUNTRIES.filter((c) => continentOf(c.code) === null).map((c) => c.code)).toEqual([]);
  });
  it('the bundled TopoJSON files are intact', () => {
    const world = JSON.parse(readFileSync('public/geo/countries-110m.json', 'utf8'));
    const ids = world.objects.countries.geometries.map((g: { id?: string }) => g.id).filter(Boolean);
    expect(ids.every((id: string) => NUMERIC_TO_ALPHA2[id])).toBe(true);
    const kr = JSON.parse(readFileSync('public/geo/kr-municipalities.json', 'utf8'));
    const geoms = Object.values(
      kr.objects as Record<string, { geometries: { properties: { code: string; name: string } }[] }>,
    )[0].geometries;
    expect(geoms.length).toBeGreaterThan(200);
    expect(geoms.every((g) => /^\d{5}$/.test(g.properties.code) && g.properties.name)).toBe(true);
    expect(new Set(geoms.map((g) => g.properties.code)).size).toBe(geoms.length);
  });
});
