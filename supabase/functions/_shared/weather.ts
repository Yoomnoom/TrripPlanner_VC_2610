// Open-Meteo forecast helpers (no key). Forecast reaches ~16 days ahead.

export function buildForecastUrl(lat: number, lng: number, start: string, end: string) {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    start_date: start,
    end_date: end,
    timezone: 'auto',
  });
  return `https://api.open-meteo.com/v1/forecast?${q.toString()}`;
}

export interface DayWeather {
  date: string;
  maxC: number | null;
  minC: number | null;
  rainPct: number | null;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Daily rows from an Open-Meteo answer; [] when the shape is unexpected. */
export function parseForecast(json: unknown): DayWeather[] {
  const d = (json as { daily?: Record<string, unknown[]> } | null)?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  return d.time.map((t, i) => ({
    date: String(t),
    maxC: num(d.temperature_2m_max?.[i]),
    minC: num(d.temperature_2m_min?.[i]),
    rainPct: num(d.precipitation_probability_max?.[i]),
  }));
}
