import { daysBetween, dayYmd, tripDays } from '@/lib/trip';

export const FORECAST_DAYS = 16;

export type WeatherKind = 'forecast' | 'archive-last-year' | 'archive-actual';

export interface WeatherPlan {
  kind: WeatherKind;
  url: string;
  /** Dates (YYYY-MM-DD) the request covers; rows map back to trip Day indexes with `dayIndexOfDate`. */
  start: string;
  end: string;
}

const addDays = (ymd: string, n: number) => dayYmd(ymd, n);

/** Same calendar dates one year earlier (Feb 29 falls back to Feb 28). */
export function lastYear(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const leapFix = m === 2 && d === 29 ? 28 : d;
  return `${y - 1}-${String(m).padStart(2, '0')}-${String(leapFix).padStart(2, '0')}`;
}

const base = (host: string, lat: number, lng: number, start: string, end: string) => {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    start_date: start,
    end_date: end,
    timezone: 'auto',
  });
  return `https://${host}/v1/${host.startsWith('archive') ? 'archive' : 'forecast'}?${q.toString()}`;
};

/**
 * Which Open-Meteo source to use (SPEC F-3-3 #2):
 * - trip fully in the past → real weather of those dates (archive)
 * - trip starts within the 16-day forecast window → forecast (days beyond the window simply have no data)
 * - trip further away → "last year, same dates" from the archive, labelled as NOT a forecast
 */
export function planWeather(
  trip: { start: string; end: string },
  lat: number,
  lng: number,
  today: string,
): WeatherPlan {
  if (trip.end < today) {
    const end = trip.end;
    // archive data lags a few days; the API answers with nulls for dates it does not have yet
    return {
      kind: 'archive-actual',
      start: trip.start,
      end,
      url: base('archive-api.open-meteo.com', lat, lng, trip.start, end),
    };
  }
  const windowEnd = addDays(today, FORECAST_DAYS - 1);
  if (trip.start <= windowEnd) {
    const start = trip.start < today ? today : trip.start;
    const end = trip.end > windowEnd ? windowEnd : trip.end;
    return { kind: 'forecast', start, end, url: base('api.open-meteo.com', lat, lng, start, end) };
  }
  const start = lastYear(trip.start);
  const end = lastYear(trip.end);
  return {
    kind: 'archive-last-year',
    start,
    end,
    url: base('archive-api.open-meteo.com', lat, lng, start, end),
  };
}

export interface DayWeather {
  date: string;
  code: number | null;
  maxC: number | null;
  minC: number | null;
  rainPct: number | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function parseDaily(json: unknown): DayWeather[] {
  const d = (json as { daily?: Record<string, unknown[]> } | null)?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((t, i) => ({
    date: String(t),
    code: num(d.weather_code?.[i]),
    maxC: num(d.temperature_2m_max?.[i]),
    minC: num(d.temperature_2m_min?.[i]),
    rainPct: num(d.precipitation_probability_max?.[i]),
  }));
}

/**
 * Trip Day index (0-based) → weather row. For last-year data the row date is shifted back by one year, so the match
 * is done on the plan's own date range rather than the trip date.
 */
export function rowsByDay(
  plan: WeatherPlan,
  rows: readonly DayWeather[],
  tripStart: string,
  dayCount: number,
) {
  const out = new Map<number, DayWeather>();
  for (let i = 0; i < dayCount; i++) {
    const tripDate = dayYmd(tripStart, i);
    const date = plan.kind === 'archive-last-year' ? lastYear(tripDate) : tripDate;
    const hit = rows.find((r) => r.date === date);
    if (hit && (hit.maxC !== null || hit.minC !== null || hit.code !== null)) out.set(i, hit);
  }
  return out;
}

/** WMO weather code → short Korean label + emoji (icon is decorative; the label carries the meaning). */
export function describeCode(code: number | null): { label: string; icon: string } {
  if (code === null) return { label: '정보 없음', icon: '·' };
  if (code === 0) return { label: '맑음', icon: '☀️' };
  if (code <= 2) return { label: '구름 조금', icon: '🌤️' };
  if (code === 3) return { label: '흐림', icon: '☁️' };
  if (code === 45 || code === 48) return { label: '안개', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { label: '이슬비', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { label: '비', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { label: '눈', icon: '🌨️' };
  if (code >= 80 && code <= 82) return { label: '소나기', icon: '🌦️' };
  if (code === 85 || code === 86) return { label: '눈 소나기', icon: '🌨️' };
  if (code >= 95) return { label: '뇌우', icon: '⛈️' };
  return { label: '정보 없음', icon: '·' };
}

export const NOTE: Record<WeatherKind, string> = {
  forecast: '예보예요',
  'archive-last-year': '예보가 아니에요. 작년 같은 기간의 실제 날씨예요',
  'archive-actual': '지난 여행의 실제 날씨예요',
};

/** How many trip days the plan can possibly answer (used to hide the section when nothing overlaps). */
export const coveredDays = (plan: WeatherPlan, tripStart: string, tripEnd: string) =>
  plan.kind === 'forecast'
    ? Math.max(0, daysBetween(plan.start, plan.end) + 1)
    : tripDays(tripStart, tripEnd);
