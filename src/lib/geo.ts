export interface LatLng {
  lat: number;
  lng: number;
}
export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000,
    rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
const SPEED_KMH = { walk: 4.5, transit: 20, drive: 30 } as const;
const EXTRA_MIN = { walk: 0, transit: 8, drive: 0 } as const;
/** 직선거리 ×1.3 보정한 추정치 */
export function estimateLeg(a: LatLng, b: LatLng, mode: 'walk' | 'transit' | 'drive') {
  const distanceM = Math.round(haversineM(a, b) * 1.3);
  const durationS = Math.round((distanceM / 1000 / SPEED_KMH[mode]) * 3600 + EXTRA_MIN[mode] * 60);
  return { distanceM, durationS, estimated: true as const };
}
