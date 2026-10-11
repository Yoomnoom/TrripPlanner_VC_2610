import { continentOf } from '@/lib/continents';
import { daysBetween, todayYmd } from '@/lib/trip';
import { yearStreak } from './yearStreak';

export { yearStreak };

export interface FootprintStats {
  countries: number;
  trips: number;
  places: number;
  cities: number;
  days: number;
  continents: number;
  yearStreak: number;
}

export interface PastTripInput {
  startDate: string;
  endDate: string;
  placeCount: number;
  cities: string[];
}

/**
 * Seven stats (SPEC 4-14). Only trips that already ended (end date before today) count as trips/places/cities/days.
 * Cities are compared case-insensitively; blank city names are ignored. Years with a trip (every year a trip touches)
 * feed the "연 연속" streak.
 */
export function computeStats(input: {
  visitedCountryCodes: string[];
  pastTrips: PastTripInput[];
  today: Date;
}): FootprintStats {
  const today = todayYmd(input.today);
  const done = input.pastTrips.filter((t) => t.endDate < today);

  const countries = new Set(input.visitedCountryCodes.map((c) => c.toUpperCase()));
  const continents = new Set<string>();
  for (const c of countries) {
    const cont = continentOf(c);
    if (cont) continents.add(cont);
  }

  const cities = new Set<string>();
  const years = new Set<number>();
  let days = 0;
  let places = 0;
  for (const t of done) {
    places += t.placeCount;
    days += daysBetween(t.startDate, t.endDate) + 1;
    for (const c of t.cities) if (c.trim()) cities.add(c.trim().toLowerCase());
    for (let y = Number(t.startDate.slice(0, 4)); y <= Number(t.endDate.slice(0, 4)); y++) years.add(y);
  }

  return {
    countries: countries.size,
    trips: done.length,
    places,
    cities: cities.size,
    days,
    continents: continents.size,
    yearStreak: yearStreak([...years], input.today.getFullYear()),
  };
}

/** Destinations of trips that ended and whose country is not yet marked visited (banner after a trip, SPEC 4-14). */
export function suggestVisited(
  trips: { id: string; title: string; endDate: string; countryCodes: string[] }[],
  visited: ReadonlySet<string>,
  today: string,
) {
  const seen = new Set<string>();
  const out: { tripId: string; tripTitle: string; code: string }[] = [];
  for (const t of trips) {
    if (t.endDate >= today) continue;
    for (const code of t.countryCodes.map((c) => c.toUpperCase())) {
      if (visited.has(code) || seen.has(code)) continue;
      seen.add(code);
      out.push({ tripId: t.id, tripTitle: t.title, code });
    }
  }
  return out;
}
