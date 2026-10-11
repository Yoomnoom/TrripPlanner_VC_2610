import { useQuery } from '@tanstack/react-query';
import { infoOf } from '@/data/country-info';
import { useTripDestinations } from '@/features/trips/api';
import { getFxRate } from '@/lib/fx';
import { todayYmd, tripDays } from '@/lib/trip';
import { parseDaily, planWeather, rowsByDay, type DayWeather, type WeatherPlan } from '@/lib/weather';

export interface Place {
  countryCode: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
}

/** Destination with usable coordinates: the stored ones, else the country's representative point. */
export function withCoords(d: {
  country_code: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
}): Place {
  const info = infoOf(d.country_code);
  return {
    countryCode: d.country_code,
    city: d.city,
    lat: d.lat ?? info?.lat ?? null,
    lng: d.lng ?? info?.lng ?? null,
  };
}

export function useDestinations(tripId: string): { list: Place[]; isPending: boolean } {
  const q = useTripDestinations(tripId);
  return { list: (q.data ?? []).map(withCoords), isPending: q.isPending };
}

export interface TripWeather {
  plan: WeatherPlan;
  byDay: Map<number, DayWeather>;
}

/**
 * Weather per trip day straight from Open-Meteo (no key, called from the browser). A failed request just yields
 * `null`: the weather UI is optional and must never block the page.
 */
export function useTripWeather(
  trip: { start_date: string; end_date: string },
  place: Place | null | undefined,
) {
  const lat = place?.lat ?? null;
  const lng = place?.lng ?? null;
  return useQuery({
    queryKey: ['weather', trip.start_date, trip.end_date, lat, lng, todayYmd()],
    enabled: lat !== null && lng !== null,
    staleTime: 30 * 60_000,
    retry: 1,
    queryFn: async (): Promise<TripWeather | null> => {
      const plan = planWeather({ start: trip.start_date, end: trip.end_date }, lat!, lng!, todayYmd());
      const res = await fetch(plan.url);
      if (!res.ok) return null;
      const byDay = rowsByDay(
        plan,
        parseDaily(await res.json()),
        trip.start_date,
        tripDays(trip.start_date, trip.end_date),
      );
      return byDay.size > 0 ? { plan, byDay } : null;
    },
  });
}

export function useFx(currency: string) {
  return useQuery({
    queryKey: ['fx', currency],
    staleTime: 60 * 60_000,
    queryFn: () => getFxRate(currency),
  });
}
