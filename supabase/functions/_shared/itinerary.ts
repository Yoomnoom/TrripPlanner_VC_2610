import { z } from 'zod';
import { PLACE_CATEGORIES } from './domain.ts';
import { AiPlanResponse } from './schemas.ts';

export type Plan = z.infer<typeof AiPlanResponse>;
export type Item = NonNullable<Plan['itinerary']>['days'][number]['items'][number];

const CATEGORY_SET = new Set<string>(PLACE_CATEGORIES);
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHmm = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/**
 * Pre-zod repair of obviously fixable model output (SPEC C-4): unknown categories become "other" and
 * a day with more than 10 items is cut. Anything else is left for zod to reject.
 */
export function normalizeRawPlan(raw: unknown): unknown {
  const j = raw as { itinerary?: { days?: unknown } | null } | null;
  const days = j?.itinerary?.days;
  if (!Array.isArray(days)) return raw;
  return {
    ...(j as object),
    itinerary: {
      ...j!.itinerary,
      days: days.map((d: { items?: unknown }) =>
        Array.isArray(d?.items)
          ? {
              ...d,
              items: d.items
                .slice(0, 10)
                .map((it: { category?: unknown }) =>
                  it && typeof it === 'object' && !CATEGORY_SET.has(String(it.category))
                    ? { ...it, category: 'other' }
                    : it,
                ),
            }
          : d,
      ),
    },
  };
}

/** Schema used with runAi: lenient pre-pass, then the strict shared schema. */
export const LenientPlan = z.preprocess(normalizeRawPlan, AiPlanResponse);

/**
 * After zod: end <= start becomes start + 60 min (clamped to 23:59), items sort by start time, days beyond the
 * trip length are dropped, and a missing day is not invented.
 */
export function fixItinerary(plan: Plan, dayCount: number): Plan {
  if (!plan.itinerary) return plan;
  const days = plan.itinerary.days
    .filter((d) => d.dayIndex >= 0 && d.dayIndex < dayCount)
    .map((d) => ({
      ...d,
      items: d.items
        .map((it) => {
          if (toMin(it.endTime) > toMin(it.startTime)) return it;
          const end = Math.min(toMin(it.startTime) + 60, 23 * 60 + 59);
          return { ...it, endTime: toHHmm(end) };
        })
        .sort((a, b) => toMin(a.startTime) - toMin(b.startTime)),
    }))
    .sort((a, b) => a.dayIndex - b.dayIndex);
  return { ...plan, itinerary: days.length > 0 ? { days } : null };
}

export interface ContextInput {
  trip: {
    title: string;
    start_date: string;
    end_date: string;
    headcount: number | null;
    budget_krw: number | null;
  };
  dayCount: number;
  destinations: { country_code: string; city: string | null }[];
  places: {
    day_index: number | null;
    name: string;
    category: string;
    start_time: string | null;
    end_time: string | null;
  }[];
  fx?: { currency: string; rate: number; date: string | null } | null;
  weather?: unknown;
  prefs?: unknown;
  mustInclude?: string[];
}

/** Compact CONTEXT for the prompt: titles/times only, never ids or personal data. */
export function buildContext(i: ContextInput) {
  return {
    trip: {
      title: i.trip.title,
      startDate: i.trip.start_date,
      endDate: i.trip.end_date,
      dayCount: i.dayCount,
      destinations: i.destinations.map((d) => ({ country: d.country_code, city: d.city })),
      headcount: i.trip.headcount,
      budget: i.trip.budget_krw,
    },
    currentItinerary: i.places
      .filter((p) => p.day_index !== null)
      .map((p) => ({
        dayIndex: p.day_index,
        name: p.name,
        category: p.category,
        startTime: p.start_time?.slice(0, 5) ?? null,
        endTime: p.end_time?.slice(0, 5) ?? null,
      })),
    ...(i.fx ? { fx: i.fx } : {}),
    ...(i.weather ? { weather: i.weather } : {}),
    ...(i.prefs ? { planningPrefs: i.prefs } : {}),
    ...(i.mustInclude?.length ? { mustInclude: i.mustInclude } : {}),
  };
}

export const wantsFx = (message: string) => /환율|엔화|달러|유로|위안|바트|원화|fx/i.test(message);
export const wantsWeather = (message: string) => /날씨|기온|비가|비 |우산|덥|추워|기후/.test(message);

/** Open-Meteo forecast only reaches ~16 days ahead. */
export const forecastInRange = (startDate: string, today: string) =>
  (Date.parse(startDate) - Date.parse(today)) / 86_400_000 <= 16;
