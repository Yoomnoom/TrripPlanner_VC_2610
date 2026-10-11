import type { LatLng } from '@/lib/geo';
import { decodePolyline } from '@/lib/polyline';

/** Day 1 purple, Day 2 red, Day 3 teal, Day 4 blue, then cycles (SPEC 4-6). */
export const DAY_COLORS = [
  '#6D4AFF',
  '#E5484D',
  '#0D9488',
  '#2563EB',
  '#F97316',
  '#CA8A04',
  '#9333EA',
  '#16A34A',
] as const;
export const dayColor = (i: number) => DAY_COLORS[i % DAY_COLORS.length];

export interface MapPlace {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  leg_polyline?: string | null;
  leg_from_place_id?: string | null;
}

export interface Pin extends LatLng {
  id: string;
  name: string;
  day: number;
  /** 1-based number within the day (counts only places that have coordinates). */
  order: number;
}

/** Pins for the shown days; places without coordinates are skipped. `filter` null = all days. */
export function buildPins(days: readonly (readonly MapPlace[])[], filter: number | null): Pin[] {
  const pins: Pin[] = [];
  days.forEach((list, day) => {
    if (filter !== null && filter !== day) return;
    let order = 0;
    for (const p of list) {
      if (p.lat === null || p.lng === null) continue;
      pins.push({ id: p.id, name: p.name, day, order: ++order, lat: p.lat, lng: p.lng });
    }
  });
  return pins;
}

/** One path per leg: the real route where cached for the exact previous place, else a straight line. */
export function buildPaths(days: readonly (readonly MapPlace[])[], filter: number | null) {
  const paths: { day: number; path: LatLng[]; straight: boolean }[] = [];
  days.forEach((list, day) => {
    if (filter !== null && filter !== day) return;
    const pts = list.filter((p) => p.lat !== null && p.lng !== null);
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const cur = pts[i];
      const real =
        cur.leg_from_place_id === prev.id && cur.leg_polyline ? decodePolyline(cur.leg_polyline) : null;
      paths.push({
        day,
        straight: !real,
        path: real ?? [
          { lat: prev.lat!, lng: prev.lng! },
          { lat: cur.lat!, lng: cur.lng! },
        ],
      });
    }
  });
  return paths;
}

export function boundsOf(points: readonly LatLng[]) {
  if (points.length === 0) return null;
  return points.reduce(
    (b, p) => ({
      south: Math.min(b.south, p.lat),
      north: Math.max(b.north, p.lat),
      west: Math.min(b.west, p.lng),
      east: Math.max(b.east, p.lng),
    }),
    { south: 90, north: -90, west: 180, east: -180 },
  );
}

/** Deep link that opens Google Maps directions to a point. */
export const directionsUrl = (to: LatLng) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}`;
