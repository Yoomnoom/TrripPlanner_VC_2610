// Pure helpers for `routes-leg` (no Deno APIs, so vitest can import them).
// UNVERIFIED against the live Google Routes API: see docs/HUMAN_TODO.md.

export type Mode = 'walk' | 'transit' | 'drive';
export interface Point {
  lat: number;
  lng: number;
}
export interface LegResult {
  durationS: number;
  distanceM: number;
  polyline: string | null;
}

export const ROUTES_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const ROUTES_FIELD_MASK = 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline';

const TRAVEL_MODE: Record<Mode, string> = { walk: 'WALK', transit: 'TRANSIT', drive: 'DRIVE' };

const isPoint = (p: unknown): p is Point => {
  const q = p as Point;
  return (
    !!q &&
    typeof q.lat === 'number' &&
    typeof q.lng === 'number' &&
    Math.abs(q.lat) <= 90 &&
    Math.abs(q.lng) <= 180
  );
};

/** Validates the request body of `routes-leg`; returns null when malformed. */
export function parseLegRequest(body: unknown): { from: Point; to: Point; mode: Mode } | null {
  const b = body as { from?: unknown; to?: unknown; mode?: unknown } | null;
  if (!b || !isPoint(b.from) || !isPoint(b.to)) return null;
  if (b.mode !== 'walk' && b.mode !== 'transit' && b.mode !== 'drive') return null;
  return { from: b.from, to: b.to, mode: b.mode };
}

export function buildComputeRoutesBody(from: Point, to: Point, mode: Mode) {
  const loc = (p: Point) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  return { origin: loc(from), destination: loc(to), travelMode: TRAVEL_MODE[mode], languageCode: 'ko' };
}

/** Google returns durations as strings like "1380s" (possibly "1380.5s"). */
export function parseDurationSeconds(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.round(v);
  if (typeof v !== 'string') return null;
  const m = v.match(/^(\d+(?:\.\d+)?)s$/);
  return m ? Math.round(Number(m[1])) : null;
}

/** Returns null when the response has no usable route (e.g. unsupported region), so callers fall back. */
export function parseComputeRoutesResponse(json: unknown): LegResult | null {
  const route = (json as { routes?: unknown[] } | null)?.routes?.[0] as
    { duration?: unknown; distanceMeters?: unknown; polyline?: { encodedPolyline?: unknown } } | undefined;
  if (!route) return null;
  const durationS = parseDurationSeconds(route.duration);
  const distanceM = typeof route.distanceMeters === 'number' ? Math.round(route.distanceMeters) : null;
  if (durationS === null || distanceM === null) return null;
  const poly = route.polyline?.encodedPolyline;
  return { durationS, distanceM, polyline: typeof poly === 'string' && poly ? poly : null };
}
